<script lang="ts">
	import { tick } from 'svelte';
	import Placeholder from '$lib/components/chat/Placeholder.svelte';
	import Messages from '$lib/components/chat/Messages.svelte';

	type ChatMessage = {
		id?: string;
		parentId?: string | null;
		childrenIds?: string[];
		role?: string;
		content?: unknown;
		promptCiphertext?: string;
		ciphertext?: string;
		[key: string]: unknown;
	};

	type ChatHistory = {
		messages: Record<string, ChatMessage>;
		currentId: string | null;
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

	const noop = async () => {};

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
				(chunk, idx) =>
					`${role === 'user' ? 'usr' : 'rsp'}_${String(idx + 1).padStart(2, '0')}::${chunk}`
			)
			.join('   ');
	};

	const findAssistantChild = (sourceHistory: ChatHistory, userMessage: ChatMessage) => {
		const childIds = userMessage?.childrenIds ?? [];

		const childFromBranch = childIds
			.map((childId: string) => sourceHistory.messages?.[childId])
			.find((message: ChatMessage | undefined) => message?.role === 'assistant');

		return (
			childFromBranch ??
			(Object.values(sourceHistory.messages ?? {}).find(
				(message: ChatMessage) =>
					message?.parentId === userMessage?.id && message?.role === 'assistant'
			) as ChatMessage | undefined)
		);
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

	const getCurrentTurnMessages = (sourceHistory: ChatHistory) => {
		const messages = sourceHistory?.messages ?? {};
		const currentMessage = sourceHistory.currentId ? messages[sourceHistory.currentId] : undefined;

		if (!currentMessage) {
			return [];
		}

		if (currentMessage.role === 'assistant') {
			const parentMessage = currentMessage.parentId ? messages[currentMessage.parentId] : undefined;
			return parentMessage?.role === 'user' ? [parentMessage, currentMessage] : [currentMessage];
		}

		if (currentMessage.role === 'user') {
			const assistant = findAssistantChild(sourceHistory, currentMessage);
			return assistant ? [currentMessage, assistant] : [currentMessage];
		}

		const branchMessages = getActiveBranchMessages(sourceHistory);
		const latestUserIndex = branchMessages.map((message) => message.role).lastIndexOf('user');

		return latestUserIndex >= 0 ? branchMessages.slice(latestUserIndex) : [currentMessage];
	};

	const buildMirrorHistory = (sourceHistory: ChatHistory) => {
		if (!sourceHistory?.messages || !sourceHistory.currentId) {
			return {
				messages: {},
				currentId: null
			};
		}

		const branchMessages = getCurrentTurnMessages(sourceHistory);

		if (branchMessages.length === 0) {
			return {
				messages: {},
				currentId: null
			};
		}

		const mirrorMessages: Record<string, ChatMessage> = {};
		let previousMirrorId: string | null = null;
		let currentMirrorId: string | null = null;

		for (const [index, sourceMessage] of branchMessages.entries()) {
			const sourceMessageId = sourceMessage.id ?? `message-${index}`;
			const mirrorMessageId = `mirror-${sourceMessageId}`;

			const nextSourceMessage = branchMessages[index + 1];

			const mirrorMessage: ChatMessage = {
				...structuredClone(sourceMessage),
				id: mirrorMessageId,
				parentId: previousMirrorId,
				childrenIds: []
			};

			if (mirrorMessage.role === 'user') {
				const rawContent =
					typeof sourceMessage.content === 'string'
						? sourceMessage.content
						: '[non-text content]';

				const branchAssistant =
					nextSourceMessage?.role === 'assistant'
						? nextSourceMessage
						: findAssistantChild(sourceHistory, sourceMessage);

				mirrorMessage.content =
					branchAssistant?.promptCiphertext ?? encodeFallbackText(rawContent, 'user');
			} else if (mirrorMessage.role === 'assistant') {
				const rawContent =
					typeof sourceMessage.content === 'string'
						? sourceMessage.content
						: '[non-text content]';

				mirrorMessage.content =
					sourceMessage.ciphertext ?? encodeFallbackText(rawContent, 'assistant');
			}

			mirrorMessages[mirrorMessageId] = mirrorMessage;

			if (previousMirrorId && mirrorMessages[previousMirrorId]) {
				mirrorMessages[previousMirrorId].childrenIds = [mirrorMessageId];
			}

			previousMirrorId = mirrorMessageId;
			currentMirrorId = mirrorMessageId;
		}

		return {
			messages: mirrorMessages,
			currentId: currentMirrorId
		};
	};

	let mirrorHistory: ChatHistory = {
		messages: {},
		currentId: null
	};

	let mirrorPrompt = '';
	let mirrorMessageInput: unknown;
	let mirrorFiles: unknown[] = [];
	let mirrorAutoScroll = true;
	let mirrorSelectedToolIds: unknown[] = [];
	let mirrorSelectedFilterIds: unknown[] = [];
	let mirrorImageGenerationEnabled = false;
	let mirrorCodeInterpreterEnabled = false;
	let mirrorWebSearchEnabled = false;
	let mirrorAtSelectedModel: unknown = undefined;
	let mirrorShowCommands = false;
	let mirrorDragged = false;

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

	$: mirrorHistory = buildMirrorHistory(history);
	$: mirrorPrompt = currentPrompt ? encodeFallbackText(currentPrompt, 'user') : '';
	$: mirrorAtSelectedModel = atSelectedModel;

	$: hasMessages = Object.values(mirrorHistory?.messages ?? {}).some(
		(message: ChatMessage) => message?.role === 'user' || message?.role === 'assistant'
	);

	$: if (mirrorHistory?.currentId) {
		scrollMirrorToBottom();
	}
</script>

<div class="flex relative h-full w-full min-w-0 flex-col bg-white overflow-hidden">
	{#if hasMessages}
		<div class="flex min-h-0 flex-1 w-full flex-col">
			<div
				bind:this={mirrorMessagesContainer}
				class="pb-2.5 flex flex-col justify-between w-full flex-auto overflow-y-auto h-0 min-h-0 max-w-full z-10 scrollbar-hidden select-none"
			>
				<div class="h-full w-full flex flex-col">
					<Messages
						chatId={`mirror-${chatId || 'new'}`}
						bind:history={mirrorHistory}
						bind:autoScroll={mirrorAutoScroll}
						bind:prompt={mirrorPrompt}
						setInputText={() => {}}
						{selectedModels}
						atSelectedModel={mirrorAtSelectedModel}
						sendMessage={noop}
						showMessage={noop}
						submitMessage={noop}
						continueResponse={noop}
						regenerateResponse={noop}
						mergeResponses={noop}
						chatActionHandler={noop}
						addMessages={noop}
						topPadding={true}
						bottomPadding={false}
						{onSelect}
					/>
				</div>
			</div>
		</div>
	{:else}
		<div class="min-h-0 flex-1 w-full overflow-hidden">
			<div class="flex h-full w-full items-center justify-center px-4 py-8">
				<div class="w-full max-w-[800px]">
					<div class="mx-auto grid h-[420px] w-full grid-rows-[80px_minmax(0,1fr)]">
						<div class="flex items-center justify-center gap-3">
							<img
								src="/favicon.png"
								class="size-10 rounded-full border border-gray-100 dark:border-none"
								aria-hidden="true"
								draggable="false"
								alt=""
							/>

							<div
								class="text-3xl @sm:text-3xl font-primary text-gray-800 dark:text-gray-100 line-clamp-1"
							>
								{modelLabel || 'Open WebUI'}
							</div>
						</div>

						<div class="min-h-0 overflow-y-auto pt-2">
							<Placeholder
								history={mirrorHistory}
								{selectedModels}
								bind:messageInput={mirrorMessageInput}
								bind:files={mirrorFiles}
								bind:prompt={mirrorPrompt}
								bind:autoScroll={mirrorAutoScroll}
								bind:selectedToolIds={mirrorSelectedToolIds}
								bind:selectedFilterIds={mirrorSelectedFilterIds}
								bind:imageGenerationEnabled={mirrorImageGenerationEnabled}
								bind:codeInterpreterEnabled={mirrorCodeInterpreterEnabled}
								bind:webSearchEnabled={mirrorWebSearchEnabled}
								bind:atSelectedModel={mirrorAtSelectedModel}
								bind:showCommands={mirrorShowCommands}
								bind:dragged={mirrorDragged}
								{pendingOAuthTools}
								{toolServers}
								stopResponse={noop}
								createMessagePair={noop}
								{onSelect}
								onUpload={noop}
								onChange={() => {}}
								on:submit={() => {}}
								showInput={false}
								showSuggestions={false}
								centeredMode={false}
								loadingCardVisible={false}
								showHeroTitle={false}
							/>
						</div>
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>
