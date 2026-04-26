<script lang="ts">
	import { tick } from 'svelte';
	import Placeholder from '$lib/components/chat/Placeholder.svelte';
	import Messages from '$lib/components/chat/Messages.svelte';

	export let chatId = '';

	export let history: any = {
		messages: {},
		currentId: null
	};

	export let selectedModels: any[] = [];
	export let atSelectedModel: any = undefined;
	export let pendingOAuthTools: any[] = [];
	export let toolServers: any[] = [];
	export let currentPrompt = '';
	export let onSelect = () => {};

	// 原代码中模板使用了 modelLabel，但 script 中没有定义，会报错
	export let modelLabel = 'Open WebUI';

	const noop = async () => {};

	const toBase64 = (text: string) => {
		const bytes = new TextEncoder().encode(text || '');
		let binary = '';

		for (const b of bytes) {
			binary += String.fromCharCode(b);
		}

		return btoa(binary);
	};

	const encryptText = (text: string, role: 'user' | 'assistant') => {
		const encoded = toBase64(text || '');
		const chunks = encoded.match(/.{1,18}/g) ?? [];

		return chunks
			.map(
				(chunk, idx) =>
					`${role === 'user' ? 'usr' : 'rsp'}_${String(idx + 1).padStart(2, '0')}::${chunk}`
			)
			.join('   ');
	};

	const buildMirrorHistory = (sourceHistory: any) => {
		if (!sourceHistory?.messages) {
			return {
				messages: {},
				currentId: null
			};
		}

		const cloned = structuredClone(sourceHistory);

		for (const id of Object.keys(cloned.messages)) {
			const msg = cloned.messages[id];

			if (msg?.role === 'user' || msg?.role === 'assistant') {
				const rawContent = typeof msg.content === 'string' ? msg.content : '[非文本内容]';
				msg.content = encryptText(rawContent, msg.role);
			}
		}

		return cloned;
	};

	let mirrorHistory: any = {
		messages: {},
		currentId: null
	};

	let mirrorPrompt = '';
	let mirrorMessageInput: any;
	let mirrorFiles: any[] = [];
	let mirrorAutoScroll = true;
	let mirrorSelectedToolIds: any[] = [];
	let mirrorSelectedFilterIds: any[] = [];
	let mirrorImageGenerationEnabled = false;
	let mirrorCodeInterpreterEnabled = false;
	let mirrorWebSearchEnabled = false;
	let mirrorAtSelectedModel: any = undefined;
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
	$: mirrorPrompt = currentPrompt ? encryptText(currentPrompt, 'user') : '';
	$: mirrorAtSelectedModel = atSelectedModel;

	$: hasMessages = Object.values(mirrorHistory?.messages ?? {}).some(
		(message: any) => message?.role === 'user' || message?.role === 'assistant'
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
						chatId={chatId}
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
								toolServers={toolServers}
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