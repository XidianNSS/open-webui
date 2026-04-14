<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { collabState, toggleCollabRibbon } from '$lib/stores/collab';

	const getCollabDetailPath = () => {
		if ($page.url.pathname.startsWith('/collab')) {
			return '/collab';
		}

		const returnTo = `${$page.url.pathname}${$page.url.search}`;
		return `/collab?returnTo=${encodeURIComponent(returnTo)}`;
	};

	const openDetailPage = async () => {
		await goto(getCollabDetailPath());
	};
</script>

{#if $collabState.enabled}
	<div
		class="inline-flex h-8 items-center overflow-hidden rounded-full bg-emerald-100 text-emerald-700 shadow-sm"
	>
		<button
			type="button"
			class="inline-flex h-full items-center gap-2 px-3 text-sm leading-none font-medium transition hover:bg-emerald-200"
			on:click={toggleCollabRibbon}
		>
			<span class="size-2 rounded-full bg-emerald-500"></span>
			<span>边云协同</span>
			<span>·</span>
			<span>{$collabState.phase === 'ready' ? '已就绪' : `准备中 ${$collabState.overallProgress}%`}</span>
		</button>

		<button
			type="button"
			class="inline-flex h-full items-center border-l border-emerald-300/70 px-2.5 text-xs font-medium transition hover:bg-emerald-200"
			on:click={openDetailPage}
		>
			详情
		</button>
	</div>
{/if}
