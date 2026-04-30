<script lang="ts">
	import { collabState, toggleCollabRibbon } from '$lib/stores/collab';
</script>

{#if $collabState.enabled && !$collabState.ribbonExpanded}
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
	</div>
{/if}