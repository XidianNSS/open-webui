<script lang="ts">
	import { collabState } from '$lib/stores/collab';
</script>

{#if $collabState.enabled}
	<div class="w-full flex justify-center mb-3">
		<div class="rounded-full px-4 py-2 text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200">
			边端 L{$collabState.edge.startLayer}-L{$collabState.edge.endLayer}
			· 云端 L{$collabState.cloud.startLayer}-L{$collabState.cloud.endLayer}
			· 切分点 Layer {$collabState.split.cutLayer}
			· {$collabState.network.status === 'connected' ? '链路正常' : '链路准备中'}
		</div>
	</div>
{/if}