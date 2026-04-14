<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { collabState } from '$lib/stores/collab';

	type HeadOwner = 'edge' | 'cloud';
	type LayerTone = 'edge' | 'balanced' | 'cloud';

	type HeadCell = {
		index: number;
		owner: HeadOwner;
	};

	type LayerRow = {
		id: number;
		code: string;
		label: string;
		heads: HeadCell[];
		edgeHeads: number;
		cloudHeads: number;
		switches: number;
		summaryTone: LayerTone;
		summaryLabel: string;
		networkModeLabel: string;
	};

	const HEADS_PER_LAYER = 24;
	const ROWS_PER_PAGE = 6;

	const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

	let currentGroup = 0;

	const getReturnPath = () => {
		const returnTo = $page.url.searchParams.get('returnTo') ?? '';

		if (returnTo.startsWith('/') && !returnTo.startsWith('/collab')) {
			return returnTo;
		}

		return '/';
	};

	const goBack = async () => {
		await goto(getReturnPath());
	};

	const getVirtualLayerCount = (totalLayers: number) => clamp(Math.round(totalLayers / 2), 12, 24);

	const buildHeads = (rowIndex: number, rowCount: number, edgePercent: number) => {
		const rowRatio = rowCount > 1 ? rowIndex / (rowCount - 1) : 0;
		const edgeBias = clamp(edgePercent / 100, 0.18, 0.82);
		const cloudStart = clamp(0.18 + (1 - edgeBias) * 0.42 + rowRatio * 0.3, 0.08, 0.94);
		const cloudWindow = 0.08 + Math.sin((rowIndex + 1) * 0.65) * 0.03;

		return Array.from({ length: HEADS_PER_LAYER }, (_, headIndex) => {
			const headRatio = headIndex / Math.max(HEADS_PER_LAYER - 1, 1);
			const wobble = Math.cos((rowIndex + 2) * (headIndex + 1) * 0.33) * 0.04;
			const threshold = clamp(cloudStart + wobble, 0.06, 0.96);
			const shouldBlend = Math.abs(headRatio - threshold) <= cloudWindow;
			const owner =
				shouldBlend && (headIndex + rowIndex) % 3 === 0
					? ('cloud' as const)
					: headRatio >= threshold
						? ('cloud' as const)
						: ('edge' as const);

			return {
				index: headIndex + 1,
				owner
			} satisfies HeadCell;
		});
	};

	const getLayerTone = (edgeHeads: number, cloudHeads: number, switches: number): LayerTone => {
		const delta = Math.abs(edgeHeads - cloudHeads);

		if (delta <= 3 || switches >= 6) return 'balanced';
		return edgeHeads > cloudHeads ? 'edge' : 'cloud';
	};

	const getSummaryLabel = (tone: LayerTone) => {
		if (tone === 'edge') return '偏边端层';
		if (tone === 'cloud') return '偏云端层';
		return '交错混合层';
	};

	const getNetworkModeLabel = (tone: LayerTone, switches: number) => {
		if (switches >= 7) return '协同执行';
		if (tone === 'edge') return '边端主执行';
		if (tone === 'cloud') return '云端主执行';
		return '协同执行';
	};

	const buildLayerRows = (
		rowCount: number,
		edgePercent: number,
		totalLayers: number,
		cutLayer: number
	): LayerRow[] => {
		const cutRatio = totalLayers > 0 ? cutLayer / totalLayers : 0.5;

		return Array.from({ length: rowCount }, (_, rowIndex) => {
			const heads = buildHeads(rowIndex, rowCount, edgePercent);
			const edgeHeads = heads.filter((head) => head.owner === 'edge').length;
			const cloudHeads = heads.length - edgeHeads;
			const switches = heads.reduce((count, head, headIndex, allHeads) => {
				if (headIndex === 0) return count;
				return count + (head.owner === allHeads[headIndex - 1].owner ? 0 : 1);
			}, 0);

			const layerProgress = rowCount > 1 ? rowIndex / (rowCount - 1) : 0;
			const cutInfluence = Math.abs(layerProgress - cutRatio) <= 0.16 ? 1 : 0;
			const adjustedSwitches = switches + cutInfluence;
			const summaryTone = getLayerTone(edgeHeads, cloudHeads, adjustedSwitches);

			return {
				id: rowIndex + 1,
				code: `L${rowIndex + 1}`,
				label: `Layer${rowIndex + 1}`,
				heads,
				edgeHeads,
				cloudHeads,
				switches,
				summaryTone,
				summaryLabel: getSummaryLabel(summaryTone),
				networkModeLabel: getNetworkModeLabel(summaryTone, adjustedSwitches)
			};
		});
	};

	$: totalLayers = Math.max($collabState.split?.totalLayers ?? 1, 1);
	$: cutLayer = clamp(Math.round($collabState.split?.cutLayer ?? Math.round(totalLayers / 2)), 1, totalLayers);
	$: edgePercent = clamp(Math.round($collabState.split?.edgePercent ?? 50), 0, 100);
	$: cloudPercent = clamp(Math.round($collabState.split?.cloudPercent ?? 100 - edgePercent), 0, 100);
	$: virtualLayerCount = getVirtualLayerCount(totalLayers);
	$: layerRows = buildLayerRows(virtualLayerCount, edgePercent, totalLayers, cutLayer);
	$: mixedLayerCount = layerRows.filter((row) => row.edgeHeads > 0 && row.cloudHeads > 0).length;
	$: totalGroups = Math.max(Math.ceil(layerRows.length / ROWS_PER_PAGE), 1);
	$: currentGroup = clamp(currentGroup, 0, totalGroups - 1);
	$: visibleRows = layerRows.slice(currentGroup * ROWS_PER_PAGE, (currentGroup + 1) * ROWS_PER_PAGE);
	$: statusLabel =
		$collabState.phase === 'ready' || $collabState.overallProgress >= 100
			? '已就绪'
			: `准备中 ${$collabState.overallProgress}%`;
</script>

<section
	class="overflow-hidden rounded-[30px] border border-slate-200/90 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] shadow-[0_24px_60px_rgba(15,23,42,0.08)] dark:border-white/8 dark:bg-[#0F1723]"
>
	<div class="border-b border-slate-200/80 px-5 py-5 dark:border-white/8 md:px-7">
		<div class="flex flex-wrap items-start justify-between gap-4">
			<div class="min-w-0">
				<div class="flex flex-wrap items-center gap-3">
					<h1 class="text-[30px] font-semibold tracking-tight text-slate-900 dark:text-white">
						逐层分块视图
					</h1>

					<div
						class="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-[13px] font-medium text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300"
					>
						<span class="mr-2 h-2 w-2 rounded-full bg-current"></span>
						{statusLabel}
					</div>

					<div
						class="inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-[13px] font-medium text-amber-700 dark:bg-amber-300/10 dark:text-amber-300"
					>
						边云切分详情
					</div>
				</div>

				<p class="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-300">
					当前切分点 L{cutLayer}，每层展示 24 个 head 的边云分配，以及神经网络的执行倾向。
				</p>
			</div>

			<button
				type="button"
				class="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300 dark:hover:border-white/20 dark:hover:text-white"
				on:click={goBack}
			>
				返回对话
			</button>
		</div>

		<div class="mt-5 grid gap-3 md:grid-cols-3">
			<div class="rounded-[22px] border border-slate-200 bg-white px-4 py-3 dark:border-white/8 dark:bg-white/[0.03]">
				<div class="text-xs text-slate-400 dark:text-slate-500">边端占比</div>
				<div class="mt-2 text-[36px] leading-none font-semibold text-slate-900 dark:text-white">
					{edgePercent}%
				</div>
			</div>

			<div class="rounded-[22px] border border-slate-200 bg-white px-4 py-3 dark:border-white/8 dark:bg-white/[0.03]">
				<div class="text-xs text-slate-400 dark:text-slate-500">云端占比</div>
				<div class="mt-2 text-[36px] leading-none font-semibold text-slate-900 dark:text-white">
					{cloudPercent}%
				</div>
			</div>

			<div class="rounded-[22px] border border-slate-200 bg-white px-4 py-3 dark:border-white/8 dark:bg-white/[0.03]">
				<div class="text-xs text-slate-400 dark:text-slate-500">混合层数</div>
				<div class="mt-2 text-[36px] leading-none font-semibold text-slate-900 dark:text-white">
					{mixedLayerCount}
				</div>
			</div>
		</div>
	</div>

	<div class="space-y-4 px-4 py-5 md:px-6">
		{#each visibleRows as row}
			<article
				class="rounded-[28px] border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.05)] dark:border-white/8 dark:bg-white/[0.025] md:p-5"
			>
				<div class="grid gap-4 xl:grid-cols-[160px_minmax(0,1fr)_220px] xl:items-center">
					<div class="min-w-0">
						<div class="text-sm font-medium tracking-wide text-slate-400 dark:text-slate-500">
							{row.code}
						</div>
						<div class="mt-2 text-[34px] font-semibold tracking-tight text-slate-900 dark:text-white">
							{row.label}
						</div>
					</div>

					<div
						class="rounded-[24px] border border-slate-200/80 bg-[linear-gradient(180deg,#fbfdff_0%,#f5f8fc_100%)] p-4 dark:border-white/8 dark:bg-white/[0.03]"
					>
						<div class="overflow-x-auto pb-2">
							<div class="min-w-max">
								<div class="flex gap-3">
									{#each row.heads as head}
										<div
											class={`flex h-[72px] w-[60px] shrink-0 flex-col items-center justify-center rounded-[20px] border text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] dark:text-white ${
												head.owner === 'edge'
													? 'border-[#F2C357] bg-[linear-gradient(180deg,#FFD566_0%,#FFC443_100%)]'
													: 'border-[#6BC4FF] bg-[linear-gradient(180deg,#76CEFF_0%,#4EAFF8_100%)]'
											}`}
										>
											<span class="text-[15px] font-semibold leading-none">{head.index}</span>
											<span class="mt-1 text-[10px] font-medium leading-none">
												{head.owner === 'edge' ? '边' : '云'}
											</span>
										</div>
									{/each}
								</div>

								<div class="mt-4 flex gap-2">
									{#each row.heads as head}
										<span
											class={`h-1.5 w-[52px] shrink-0 rounded-full ${
												head.owner === 'edge' ? 'bg-[#FFB800]' : 'bg-[#45B4FF]'
											}`}
										></span>
									{/each}
								</div>
							</div>
						</div>

						<div class="mt-3 text-xs text-slate-500 dark:text-slate-400">
							切换 {row.switches} 次
						</div>
					</div>

					<div
						class="rounded-[24px] border border-slate-200/80 bg-[#FFFCF6] p-4 dark:border-white/8 dark:bg-white/[0.03]"
					>
						<div
							class={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
								row.summaryTone === 'edge'
									? 'bg-amber-100 text-amber-700 dark:bg-amber-300/10 dark:text-amber-300'
									: row.summaryTone === 'cloud'
										? 'bg-sky-100 text-sky-700 dark:bg-sky-400/10 dark:text-sky-300'
										: 'bg-violet-100 text-violet-700 dark:bg-violet-400/10 dark:text-violet-300'
							}`}
						>
							{row.summaryLabel}
						</div>

						<div class="relative mt-4 h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/8">
							<div
								class="absolute inset-y-0 left-0 rounded-full bg-[linear-gradient(90deg,#FFC443_0%,#FFB629_100%)]"
								style={`width:${(row.edgeHeads / HEADS_PER_LAYER) * 100}%`}
							></div>
							<div
								class="absolute inset-y-0 right-0 rounded-full bg-[linear-gradient(90deg,#53B8FF_0%,#3AA3F5_100%)]"
								style={`width:${(row.cloudHeads / HEADS_PER_LAYER) * 100}%`}
							></div>
						</div>

						<div class="mt-4 space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
							<div>Head: 边 {row.edgeHeads} / 云 {row.cloudHeads}</div>
							<div>神经网络: {row.networkModeLabel}</div>
						</div>
					</div>
				</div>
			</article>
		{/each}
	</div>

	<div
		class="flex flex-col gap-3 border-t border-slate-200/80 px-4 py-4 text-sm text-slate-500 dark:border-white/8 dark:text-slate-400 md:px-6 lg:flex-row lg:items-center lg:justify-between"
	>
		<div>每页展示 6 层，当前先按演示切分数据呈现，后续可以直接替换成真实逐层数组。</div>

		<div class="flex items-center gap-3 self-end lg:self-auto">
			<button
				type="button"
				class="rounded-xl border border-slate-200 bg-white px-4 py-2 font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-45 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300"
				on:click={() => (currentGroup = Math.max(currentGroup - 1, 0))}
				disabled={currentGroup === 0}
			>
				上一组
			</button>

			<div class="min-w-[90px] text-center text-slate-600 dark:text-slate-300">
				第 {currentGroup + 1} / {totalGroups} 组
			</div>

			<button
				type="button"
				class="rounded-xl border border-slate-200 bg-white px-4 py-2 font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-45 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300"
				on:click={() => (currentGroup = Math.min(currentGroup + 1, totalGroups - 1))}
				disabled={currentGroup >= totalGroups - 1}
			>
				下一组
			</button>
		</div>
	</div>
</section>
