<script lang="ts">
	import Placeholder from '$lib/components/chat/Placeholder.svelte';
	import Messages from '$lib/components/chat/Messages.svelte';
	import MessageInput from '$lib/components/chat/MessageInput.svelte';

	export let chatId = '';
	export let history = {
		messages: {},
		currentId: null
	};

	export let selectedModels = [];
	export let atSelectedModel = undefined;
	export let pendingOAuthTools = [];
	export let toolServers = [];
	export let currentPrompt = '';
	export let onSelect = () => {};

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
				const rawContent =
					typeof msg.content === 'string' ? msg.content : '[非文本内容]';

				msg.content = encryptText(rawContent, msg.role);
			}
		}

		return cloned;
	};

	let mirrorHistory = {
		messages: {},
		currentId: null
	};

	let mirrorPrompt = '';
	let mirrorMessageInput;
	let mirrorFiles = [];
	let mirrorAutoScroll = true;
	let mirrorSelectedToolIds = [];
	let mirrorSelectedFilterIds = [];
	let mirrorImageGenerationEnabled = false;
	let mirrorCodeInterpreterEnabled = false;
	let mirrorWebSearchEnabled = false;
	let mirrorAtSelectedModel = undefined;
	let mirrorShowCommands = false;
	let mirrorDragged = false;
	let mirrorGenerating = false;
	let mirrorTaskIds = null;

	$: mirrorHistory = buildMirrorHistory(history);
	$: mirrorPrompt = currentPrompt ? encryptText(currentPrompt, 'user') : '';
	$: mirrorAtSelectedModel = atSelectedModel;

	$: hasMessages = Object.values(mirrorHistory?.messages ?? {}).some(
		(message: any) => message?.role === 'user' || message?.role === 'assistant'
	);
</script>

<div class="hidden xl:flex relative h-full w-1/2 min-w-[520px] flex-col bg-white border-l border-slate-200/60 overflow-hidden">
	{#if hasMessages}
		<div class="flex min-h-0 flex-1 w-full flex-col">
			<div
				class="pb-2.5 flex flex-col justify-between w-full flex-auto overflow-auto h-0 max-w-full z-10 scrollbar-hidden pointer-events-none select-none"
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
		<div class="relative flex min-h-0 flex-1 w-full flex-col items-center px-4 pb-4 pointer-events-none select-none overflow-hidden">
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
			/>

			<!-- 白色遮罩：盖住底部输入框和版本号 -->
			<div class="absolute bottom-0 left-0 right-0 h-[520px] bg-white z-30"></div>
		</div>
	{/if}
</div>