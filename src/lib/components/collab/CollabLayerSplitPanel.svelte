<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { collabState } from '$lib/stores/collab';

	type HeadOwner = 'edge' | 'cloud';
	type LayerTone = 'edge' | 'balanced' | 'cloud';
	type FFNOwner = 'edge' | 'cloud' | 'hybrid';

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
		summaryTone: LayerTone;
		summaryLabel: string;
		ffnOwner: FFNOwner;
		ffnLabel: string;
	};

	const HEADS_PER_LAYER = 24;
	const HEADS_PER_ROW = 16;
	const HEAD_CELL_MIN_WIDTH = 44;
	const HEAD_CELL_HEIGHT = 56;
	const HEAD_CELL_GAP = 8;
	const HEAD_CELL_RADIUS = 16;
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
		const cloudStart = clamp(0.22 + (1 - edgeBias) * 0.44 + rowRatio * 0.28, 0.08, 0.94);
		const cloudWindow = 0.06 + Math.sin((rowIndex + 1) * 0.72) * 0.025;

		return Array.from({ length: HEADS_PER_LAYER }, (_, headIndex) => {
			const headRatio = headIndex / Math.max(HEADS_PER_LAYER - 1, 1);
			const wobble = Math.cos((rowIndex + 2) * (headIndex + 1) * 0.31) * 0.04;
			const threshold = clamp(cloudStart + wobble, 0.06, 0.96);
			const owner = headRatio >= threshold ? ('cloud' as const) : ('edge' as const);

			return {
				index: headIndex + 1,
				owner
			} satisfies HeadCell;
		});
	};

	const getLayerTone = (edgeHeads: number, cloudHeads: number): LayerTone => {
		const delta = Math.abs(edgeHeads - cloudHeads);

		if (delta <= 3) return 'balanced';
		return edgeHeads > cloudHeads ? 'edge' : 'cloud';
	};

	const getSummaryLabel = (tone: LayerTone) => {
		if (tone === 'edge') return '偏边端层';
		if (tone === 'cloud') return '偏云端层';
		return '边云混合层';
	};

	const getFFNOwner = (
		rowIndex: number,
		rowCount: number,
		totalLayers: number,
		cutLayer: number
	): FFNOwner => {
		const virtualCut = clamp(Math.round((cutLayer / Math.max(totalLayers, 1)) * rowCount), 1, rowCount);

		if (rowIndex + 1 < virtualCut - 1) return 'edge';
		if (rowIndex + 1 > virtualCut + 1) return 'cloud';
		return rowIndex % 2 === 0 ? 'edge' : 'hybrid';
	};

	const getFFNLabel = (ffnOwner: FFNOwner) => {
		if (ffnOwner === 'edge') return 'FFN: 边端执行';
		if (ffnOwner === 'cloud') return 'FFN: 云端执行';
		return 'FFN: 边云协同';
	};

	const buildLayerRows = (
		rowCount: number,
		edgePercent: number,
		totalLayers: number,
		cutLayer: number
	): LayerRow[] => {
		return Array.from({ length: rowCount }, (_, rowIndex) => {
			const heads = buildHeads(rowIndex, rowCount, edgePercent);
			const edgeHeads = heads.filter((head) => head.owner === 'edge').length;
			const cloudHeads = heads.length - edgeHeads;
			const summaryTone = getLayerTone(edgeHeads, cloudHeads);
			const ffnOwner = getFFNOwner(rowIndex, rowCount, totalLayers, cutLayer);

			return {
				id: rowIndex + 1,
				code: `L${rowIndex + 1}`,
				label: `Layer${rowIndex + 1}`,
				heads,
				edgeHeads,
				cloudHeads,
				summaryTone,
				summaryLabel: getSummaryLabel(summaryTone),
				ffnOwner,
				ffnLabel: getFFNLabel(ffnOwner)
			};
		});
	};

	const getFFNClassName = (ffnOwner: FFNOwner) => {
		if (ffnOwner === 'edge') return 'text-amber-700 dark:text-amber-300';
		if (ffnOwner === 'cloud') return 'text-sky-700 dark:text-sky-300';
		return 'text-violet-700 dark:text-violet-300';
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
			? '准备完成'
			: `准备中 ${$collabState.overallProgress}%`;
</script>

<section class="bg-transparent">
	<div class="border-b border-slate-200/75 px-4 py-5 dark:border-white/8 md:px-6">
		<div class="flex flex-wrap items-start justify-between gap-4">
			<div class="min-w-0">
				<div class="flex flex-wrap items-center gap-3">
					<h1 class="text-[28px] font-semibold tracking-tight text-slate-900 dark:text-white">
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
					当前切分点 L{cutLayer}，每层展示 24 个 head 的边云分配，以及 FFN 的执行位置。
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

		<div
			class="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-slate-500 dark:text-slate-300"
		>
			<div>
				<span class="text-slate-400 dark:text-slate-500">切分点</span>
				<span class="ml-2 text-lg font-semibold text-slate-900 dark:text-white">L{cutLayer}</span>
			</div>
			<div>
				<span class="text-slate-400 dark:text-slate-500">边端占比</span>
				<span class="ml-2 text-lg font-semibold text-slate-900 dark:text-white">{edgePercent}%</span>
			</div>
			<div>
				<span class="text-slate-400 dark:text-slate-500">云端占比</span>
				<span class="ml-2 text-lg font-semibold text-slate-900 dark:text-white">{cloudPercent}%</span>
			</div>
			<div>
				<span class="text-slate-400 dark:text-slate-500">混合层数</span>
				<span class="ml-2 text-lg font-semibold text-slate-900 dark:text-white">
					{mixedLayerCount}
				</span>
			</div>
			<div class="flex flex-wrap items-center gap-3">
				<div class="inline-flex items-center gap-2">
					<span class="h-3 w-3 rounded-full bg-[#FFB629]"></span>
					<span>边端颜色</span>
				</div>
				<div class="inline-flex items-center gap-2">
					<span class="h-3 w-3 rounded-full bg-[#45B4FF]"></span>
					<span>云端颜色</span>
				</div>
			</div>
		</div>
	</div>

	<div class="px-4 md:px-6">
		{#each visibleRows as row}
			<article class="border-b border-slate-200/75 py-7 last:border-b-0 dark:border-white/8">
				<div class="grid gap-5 xl:grid-cols-[130px_minmax(0,1fr)_240px] xl:items-center">
					<div class="min-w-0">
						<div class="text-sm font-medium tracking-wide text-slate-400 dark:text-slate-500">
							{row.code}
						</div>
						<div class="mt-2 text-[24px] font-semibold tracking-tight text-slate-900 dark:text-white md:text-[34px]">
							{row.label}
						</div>
					</div>

					<div class="py-1">
						<div class="overflow-x-auto pb-2">
							<div
								class="grid"
								style={`gap:${HEAD_CELL_GAP}px; grid-template-columns: repeat(${HEADS_PER_ROW}, minmax(${HEAD_CELL_MIN_WIDTH}px, 1fr)); min-width:${HEADS_PER_ROW * (HEAD_CELL_MIN_WIDTH + HEAD_CELL_GAP)}px;`}
							>
								{#each row.heads as head}
									<div
										class={`flex flex-col items-center justify-center border px-1.5 text-center text-slate-900 dark:text-white ${
											head.owner === 'edge'
												? 'border-[#F2C357] bg-[linear-gradient(180deg,#FFD566_0%,#FFC443_100%)]'
												: 'border-[#6BC4FF] bg-[linear-gradient(180deg,#76CEFF_0%,#4EAFF8_100%)]'
										}`}
										style={`height:${HEAD_CELL_HEIGHT}px; border-radius:${HEAD_CELL_RADIUS}px;`}
									>
										<span class="text-[10px] font-semibold uppercase tracking-[0.06em]">
											head {head.index}
										</span>
										<span class="mt-1 text-[9px] font-medium leading-none">
											{head.owner === 'edge' ? '边端' : '云端'}
										</span>
									</div>
								{/each}
							</div>
						</div>

						<div class={`mt-3 text-xs font-medium ${getFFNClassName(row.ffnOwner)}`}>
							{row.ffnLabel}
						</div>
					</div>

					<div
						class="border-t border-slate-200/75 pt-4 dark:border-white/8 xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0"
					>
						<div class="flex items-center justify-between gap-3">
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

							<div class="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
								<span class="inline-flex items-center gap-1">
									<span class="h-2.5 w-2.5 rounded-full bg-[#FFB629]"></span>
									边端
								</span>
								<span class="inline-flex items-center gap-1">
									<span class="h-2.5 w-2.5 rounded-full bg-[#45B4FF]"></span>
									云端
								</span>
							</div>
						</div>

						<div class="relative mt-4 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/8">
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
							<div>Heads: 边端 {row.edgeHeads} / 云端 {row.cloudHeads}</div>
							<div class={getFFNClassName(row.ffnOwner)}>{row.ffnLabel}</div>
						</div>
					</div>
				</div>
			</article>
		{/each}
	</div>

	<div
		class="flex flex-col gap-3 border-t border-slate-200/80 px-4 py-4 text-sm text-slate-500 dark:border-white/8 dark:text-slate-400 md:px-6 lg:flex-row lg:items-center lg:justify-between"
	>
		<div>每页展示 6 层，逐层查看 head 分配和 FFN 落点；后续接真实接口时可直接替换成后端返回的层级数据。</div>

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
