<script lang="ts">
	import { tick } from 'svelte';

	type ChatMessage = {
		id?: string;
		parentId?: string | null;
		childrenIds?: string[];
		role?: string;
		content?: unknown;
		promptCiphertext?: string;
		ciphertext?: string;
		timestamp?: number;
		[key: string]: unknown;
	};

	type ChatHistory = {
		messages: Record<string, ChatMessage>;
		currentId: string | null;
	};

	type MirrorMessage = {
		id: string;
		role: 'user' | 'assistant';
		content: string;
		timestamp?: number;
	};

	export let chatId = '';

	export let history: ChatHistory = {
		messages: {},
		currentId: null
	};

	export let selectedModels: unknown[] = [];
	export let atSelectedModel: unknown = undefined;
	export let pendingOAuthTools: unknown[] = [];
	export let toolServers: unknown[] = [];
	export let currentPrompt = '';
	export let onSelect = () => {};
	export let modelLabel = 'Open WebUI';

	const toBase64 = (text: string) => {
		const bytes = new TextEncoder().encode(text || '');
		let binary = '';

		for (const byte of bytes) {
			binary += String.fromCharCode(byte);
		}

		return btoa(binary);
	};

	const encodeFallbackText = (text: string, role: 'user' | 'assistant') => {
		const encoded = toBase64(text || '');
		const chunks = encoded.match(/.{1,18}/g) ?? [];

		return chunks
			.map(
				(chunk, index) =>
					`${role === 'user' ? 'usr' : 'rsp'}_${String(index + 1).padStart(2, '0')}::${chunk}`
			)
			.join('   ');
	};

	const textContentFromMessage = (content: unknown) => {
		if (typeof content === 'string') {
			return content;
		}

		if (Array.isArray(content)) {
			return content
				.map((part) => {
					if (typeof part === 'string') {
						return part;
					}

					if (part && typeof part === 'object') {
						const item = part as Record<string, unknown>;

						if (typeof item.text === 'string') {
							return item.text;
						}

						if (typeof item.content === 'string') {
							return item.content;
						}
					}

					return '';
				})
				.filter(Boolean)
				.join('\n');
		}

		return '[non-text content]';
	};

	const getActiveBranchMessages = (sourceHistory: ChatHistory) => {
		const messages = sourceHistory?.messages ?? {};
		const branch: ChatMessage[] = [];
		const visited = new Set<string>();

		let currentId = sourceHistory?.currentId;

		while (currentId && messages[currentId] && !visited.has(currentId)) {
			visited.add(currentId);
			branch.push(messages[currentId]);

			currentId = messages[currentId].parentId ?? null;
		}

		return branch.reverse();
	};

	const findAssistantForUser = (
		sourceHistory: ChatHistory,
		branchMessages: ChatMessage[],
		userMessage: ChatMessage,
		userIndex: number
	) => {
		const branchChild = branchMessages
			.slice(userIndex + 1)
			.find((message) => message.role === 'assistant' && message.parentId === userMessage.id);

		if (branchChild) {
			return branchChild;
		}

		const childIds = userMessage.childrenIds ?? [];
		const childFromHistory = childIds
			.map((childId) => sourceHistory.messages?.[childId])
			.find((message) => message?.role === 'assistant');

		if (childFromHistory) {
			return childFromHistory;
		}

		return Object.values(sourceHistory.messages ?? {}).find(
			(message) => message?.parentId === userMessage.id && message?.role === 'assistant'
		);
	};

	const buildMirrorMessages = (sourceHistory: ChatHistory, prompt: string): MirrorMessage[] => {
		const branchMessages = getActiveBranchMessages(sourceHistory);
		const mirrorMessages: MirrorMessage[] = [];

		for (const [index, sourceMessage] of branchMessages.entries()) {
			if (sourceMessage.role !== 'user' && sourceMessage.role !== 'assistant') {
				continue;
			}

			const rawContent = textContentFromMessage(sourceMessage.content);
			const sourceMessageId = sourceMessage.id ?? `message-${index}`;

			if (sourceMessage.role === 'user') {
				const pairedAssistant = findAssistantForUser(
					sourceHistory,
					branchMessages,
					sourceMessage,
					index
				);

				mirrorMessages.push({
					id: `mirror-input-${sourceMessageId}`,
					role: 'user',
					content:
						sourceMessage.promptCiphertext ??
						pairedAssistant?.promptCiphertext ??
						sourceMessage.ciphertext ??
						encodeFallbackText(rawContent, 'user'),
					timestamp: sourceMessage.timestamp
				});

				continue;
			}

			mirrorMessages.push({
				id: `mirror-output-${sourceMessageId}`,
				role: 'assistant',
				content: sourceMessage.ciphertext ?? encodeFallbackText(rawContent, 'assistant'),
				timestamp: sourceMessage.timestamp
			});
		}

		if (prompt.trim()) {
			mirrorMessages.push({
				id: 'mirror-pending-input',
				role: 'user',
				content: encodeFallbackText(prompt, 'user')
			});
		}

		return mirrorMessages;
	};

	const formatTime = (timestamp?: number) => {
		if (!timestamp) {
			return '';
		}

		return new Date(timestamp * 1000).toLocaleTimeString([], {
			hour: '2-digit',
			minute: '2-digit'
		});
	};

	let mirrorMessages: MirrorMessage[] = [];
	let mirrorMessagesContainer: HTMLDivElement;

	const scrollMirrorToBottom = async () => {
		await tick();

		if (mirrorMessagesContainer) {
			mirrorMessagesContainer.scrollTo({
				top: mirrorMessagesContainer.scrollHeight,
				behavior: 'auto'
			});
		}
	};

	$: void chatId;
	$: void selectedModels;
	$: void atSelectedModel;
	$: void pendingOAuthTools;
	$: void toolServers;
	$: void onSelect;
	$: mirrorMessages = buildMirrorMessages(history, currentPrompt);
	$: hasMessages = mirrorMessages.length > 0;

	$: if (history?.currentId || currentPrompt) {
		scrollMirrorToBottom();
	}
</script>

<div class="relative flex h-full w-full min-w-0 flex-col overflow-hidden bg-white dark:bg-gray-950">
	<div
		class="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-white/10"
	>
		<div class="min-w-0">
			<div class="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">明密文转换</div>
			<div class="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">
				{modelLabel || 'Open WebUI'} · 当前对话全量密文
			</div>
		</div>

		<div
			class="ml-3 rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-[11px] font-medium text-cyan-700 dark:border-cyan-400/25 dark:bg-cyan-400/10 dark:text-cyan-200"
		>
			{mirrorMessages.length} 条
		</div>
	</div>

	{#if hasMessages}
		<div
			bind:this={mirrorMessagesContainer}
			class="min-h-0 flex-1 overflow-y-auto px-4 py-4 scrollbar-hidden"
		>
			<div class="flex w-full flex-col gap-3">
				{#each mirrorMessages as message (message.id)}
					<div class={`flex w-full ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
						<article
							class={`max-w-[92%] overflow-hidden rounded-3xl border px-4 py-3 shadow-sm ${
								message.role === 'user'
									? 'border-gray-100 bg-gray-50 text-gray-900 dark:border-white/10 dark:bg-gray-800 dark:text-gray-100'
									: 'border-transparent bg-transparent text-gray-900 shadow-none dark:text-gray-100'
							}`}
						>
							<div
								class="max-w-full whitespace-pre-wrap break-all text-sm leading-6 [overflow-wrap:anywhere]"
							>
								{message.content}
							</div>

							{#if formatTime(message.timestamp)}
								<div
									class={`mt-1.5 text-[11px] opacity-50 ${
										message.role === 'user' ? 'text-right' : 'text-left'
									}`}
								>
									{formatTime(message.timestamp)}
								</div>
							{/if}
						</article>
					</div>
				{/each}
			</div>
		</div>
	{:else}
		<div class="min-h-0 flex-1 overflow-hidden">
			<div class="flex h-full w-full items-center justify-center px-4 py-8">
				<div class="w-full max-w-[520px] text-center">
					<div class="mx-auto flex items-center justify-center gap-3">
						<img
							src="/favicon.png"
							class="size-10 rounded-full border border-gray-100 dark:border-none"
							aria-hidden="true"
							draggable="false"
							alt=""
						/>

						<div class="line-clamp-1 font-primary text-2xl text-gray-800 dark:text-gray-100">
							{modelLabel || 'Open WebUI'}
						</div>
					</div>

					<div
						class="mt-8 rounded-3xl border border-dashed border-gray-200 bg-gray-50 px-6 py-8 text-sm leading-6 text-gray-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-400"
					>
						发送消息后，这里会按时间顺序展示转换后的密文内容。
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>
