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

	/**
	 * true：只显示当前这一轮的真实密文，避免先显示之前测试过的旧密文。
	 * false：显示整条 active branch 的真实密文历史。
	 */
	const SHOW_ONLY_CURRENT_TURN = false;

	const withRecordId = (message: ChatMessage | undefined, id: string): ChatMessage | undefined => {
		if (!message) {
			return undefined;
		}

		return {
			...message,
			id: message.id ?? id
		};
	};

	const isValidCiphertext = (value: unknown): value is string => {
		return typeof value === 'string' && value.trim().length > 0;
	};

	const extractCurrentPromptCiphertext = (
		fullPromptCiphertext?: string,
		previousFullPromptCiphertext?: string
	) => {
		if (!isValidCiphertext(fullPromptCiphertext)) {
			return undefined;
		}

		const currentFull = fullPromptCiphertext.trim();

		if (!isValidCiphertext(previousFullPromptCiphertext)) {
			return currentFull;
		}

		const previousFull = previousFullPromptCiphertext.trim();

		if (currentFull.startsWith(previousFull)) {
			const currentOnly = currentFull.slice(previousFull.length).trim();
			return currentOnly || undefined;
		}

		return currentFull;
	};

	const findAssistantChild = (sourceHistory: ChatHistory, userMessage: ChatMessage) => {
		const childIds = userMessage?.childrenIds ?? [];

		const childFromBranch = childIds
			.map((childId: string) => withRecordId(sourceHistory.messages?.[childId], childId))
			.find((message: ChatMessage | undefined) => message?.role === 'assistant');

		if (childFromBranch) {
			return childFromBranch;
		}

		const fallbackEntry = Object.entries(sourceHistory.messages ?? {}).find(
			([, message]) => message?.parentId === userMessage?.id && message?.role === 'assistant'
		);

		return fallbackEntry ? withRecordId(fallbackEntry[1], fallbackEntry[0]) : undefined;
	};

	const getActiveBranchMessages = (sourceHistory: ChatHistory) => {
		const messages = sourceHistory?.messages ?? {};
		const branch: ChatMessage[] = [];
		const visited = new Set<string>();

		let currentId = sourceHistory?.currentId;

		while (currentId && messages[currentId] && !visited.has(currentId)) {
			visited.add(currentId);

			const currentMessage = withRecordId(messages[currentId], currentId);

			if (currentMessage) {
				branch.push(currentMessage);
				currentId = currentMessage.parentId ?? null;
			} else {
				currentId = null;
			}
		}

		return branch.reverse();
	};

	const getCurrentTurnMessages = (sourceHistory: ChatHistory) => {
		const messages = sourceHistory?.messages ?? {};
		const currentMessage =
			sourceHistory.currentId && messages[sourceHistory.currentId]
				? withRecordId(messages[sourceHistory.currentId], sourceHistory.currentId)
				: undefined;

		if (!currentMessage) {
			return [];
		}

		if (currentMessage.role === 'assistant') {
			const parentMessage =
				currentMessage.parentId && messages[currentMessage.parentId]
					? withRecordId(messages[currentMessage.parentId], currentMessage.parentId)
					: undefined;

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

		const sourceMessages = SHOW_ONLY_CURRENT_TURN
			? getCurrentTurnMessages(sourceHistory)
			: getActiveBranchMessages(sourceHistory);

		if (sourceMessages.length === 0) {
			return {
				messages: {},
				currentId: null
			};
		}

		const mirrorMessages: Record<string, ChatMessage> = {};
		let previousMirrorId: string | null = null;
		let currentMirrorId: string | null = null;
		let previousFullPromptCiphertext: string | undefined = undefined;

		for (const [index, sourceMessage] of sourceMessages.entries()) {
			const sourceMessageId =
				sourceMessage.id ??
				`${sourceMessage.role ?? 'message'}-${sourceMessage.parentId ?? 'root'}-${index}`;

			const mirrorMessageId = `mirror-${sourceMessageId}`;
			const nextSourceMessage = sourceMessages[index + 1];

			const mirrorMessage: ChatMessage = {
				...structuredClone(sourceMessage),
				id: mirrorMessageId,
				parentId: previousMirrorId,
				childrenIds: []
			};

			if (mirrorMessage.role === 'user') {
				const branchAssistant =
					nextSourceMessage?.role === 'assistant'
						? nextSourceMessage
						: findAssistantChild(sourceHistory, sourceMessage);

				const fullPromptCiphertext =
					typeof branchAssistant?.promptCiphertext === 'string'
						? branchAssistant.promptCiphertext
						: undefined;

				const currentPromptCiphertext = extractCurrentPromptCiphertext(
					fullPromptCiphertext,
					previousFullPromptCiphertext
				);

				/**
				 * 关键修改：
				 * 没有真实 promptCiphertext 时，直接不显示 user 气泡。
				 * 不再显示 usr_01::xxxx 这种 fallback，也不显示旧测试密文。
				 */
				if (!isValidCiphertext(currentPromptCiphertext)) {
					continue;
				}

				mirrorMessage.content = currentPromptCiphertext;

				if (isValidCiphertext(fullPromptCiphertext)) {
					previousFullPromptCiphertext = fullPromptCiphertext;
				}
			} else if (mirrorMessage.role === 'assistant') {
				/**
				 * 关键修改：
				 * 没有真实 ciphertext 时，直接不显示 assistant 气泡。
				 * 这样生成过程中不会先显示旧内容或黑点占位。
				 */
				if (!isValidCiphertext(sourceMessage.ciphertext)) {
					continue;
				}

				mirrorMessage.content = sourceMessage.ciphertext.trim();
			} else {
				continue;
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

	/**
	 * 关键修改：
	 * 输入过程中不显示 fallback 密文。
	 * 只等后端返回真实 promptCiphertext / ciphertext 后再显示。
	 */
	$: mirrorPrompt = '';

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
						history={mirrorHistory}
						autoScroll={mirrorAutoScroll}
						prompt={mirrorPrompt}
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