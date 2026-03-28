<script lang="ts">
	import { collabState, toggleCollabRibbon } from '$lib/stores/collab';
</script>

{#if $collabState.enabled}
	<button
		type="button"
		class="inline-flex h-8 items-center gap-2 rounded-full px-3 text-sm leading-none font-medium
		bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition
		whitespace-nowrap shrink-0 shadow-sm"
		on:click={toggleCollabRibbon}
	>
		<span class="size-2 rounded-full bg-emerald-500"></span>
		<span>边云协同</span>
		<span>·</span>
		<span>{$collabState.phase === 'ready' ? '已就绪' : `准备中 ${$collabState.overallProgress}%`}</span>
	</button>
{/if}