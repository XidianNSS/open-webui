<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import CollabLayerSplitPanel from '$lib/components/collab/CollabLayerSplitPanel.svelte';
	import { chatId } from '$lib/stores';
	import { collabState } from '$lib/stores/collab';

	const getReturnPath = () => {
		const returnTo = $page.url.searchParams.get('returnTo') ?? '';

		if (returnTo.startsWith('/') && !returnTo.startsWith('/collab')) {
			return returnTo;
		}

		if ($chatId && !$chatId.startsWith('local:')) {
			return `/c/${$chatId}`;
		}

		return '/';
	};
</script>

<div class="h-screen max-h-[100dvh] w-full min-w-0 flex-1 overflow-y-auto bg-white dark:bg-[#0B1220]">
	{#if $collabState.enabled}
		<div class="mx-auto max-w-[1680px] px-6 py-5 md:px-10 md:py-6">
			<CollabLayerSplitPanel />
		</div>
	{:else}
		<div class="mx-auto flex min-h-full max-w-[760px] items-center px-4 py-10">
			<section
				class="w-full rounded-[24px] border border-slate-200/85 bg-white p-8 text-center dark:border-white/8 dark:bg-[#0F1723]"
			>
				<h1 class="text-[28px] font-semibold tracking-tight text-slate-900 dark:text-white">
					边云协同尚未就绪
				</h1>
				<p class="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-300">
					先在聊天页选择支持边云协同的模型，完成准备后再来看逐层切分详情。
				</p>
				<button
					type="button"
					class="mt-6 rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300"
					on:click={() => goto(getReturnPath())}
				>
					返回聊天
				</button>
			</section>
		</div>
	{/if}
</div>
