<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import CollabLayerSplitPanel from '$lib/components/collab/CollabLayerSplitPanel.svelte';
	import { collabState } from '$lib/stores/collab';

	const getReturnPath = () => {
		const returnTo = $page.url.searchParams.get('returnTo') ?? '';

		if (returnTo.startsWith('/') && !returnTo.startsWith('/collab')) {
			return returnTo;
		}

		return '/';
	};
</script>

<div
	class="h-screen max-h-[100dvh] w-full overflow-y-auto bg-[radial-gradient(circle_at_top,#eef7ff_0%,#f8fbff_34%,#f5f7fb_100%)] dark:bg-[#0B1220]"
>
	{#if $collabState.enabled}
		<div class="mx-auto max-w-[1440px] px-4 py-5 md:px-7 md:py-7">
			<CollabLayerSplitPanel />
		</div>
	{:else}
		<div class="mx-auto flex min-h-full max-w-[760px] items-center px-4 py-10">
			<section
				class="w-full rounded-[28px] border border-slate-200/85 bg-white/95 p-8 text-center shadow-[0_24px_60px_rgba(15,23,42,0.08)] dark:border-white/8 dark:bg-[#0F1723]"
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
