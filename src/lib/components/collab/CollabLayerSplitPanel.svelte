<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { collabState, type StrategyLayerPartition } from '$lib/stores/collab';

	type HeadOwner = 'edge' | 'cloud';
	type FFNOwner = 'edge' | 'cloud' | 'hybrid';

	type HeadCell = {
		index: number;
		owner: HeadOwner;
	};

	type LayerRow = {
		id: number;
		label: string;
		heads: HeadCell[];
		edgeHeads: number;
		cloudHeads: number;
		ffnOwner: FFNOwner;
		ffnLabel: string;
	};

	const HEADS_PER_ROW = 20;
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
		sessionStorage.setItem('skipCollabReload', '1');
		sessionStorage.setItem('skipCollabRibbonAnimation', '1');
		await goto(getReturnPath());
	};

	const ownerFromAssignment = (assignment: number | undefined): HeadOwner => {
		if (assignment === 0) return 'edge';
		if (assignment === 1) return 'cloud';

		throw new Error(`未知 head 分配值: ${assignment}`);
	};

	const ffnOwnerFromAssignment = (assignment: number | undefined): FFNOwner => {
		if (assignment === 0) return 'edge';
		if (assignment === 1) return 'cloud';
		if (assignment === 2) return 'hybrid';

		throw new Error(`未知 FFN 分配值: ${assignment}`);
	};

	const getFFNLabel = (ffnOwner: FFNOwner) => {
		if (ffnOwner === 'edge') return 'FFN: 边端执行';
		if (ffnOwner === 'cloud') return 'FFN: 云端执行';
		return 'FFN: 边云协同';
	};

	const getFFNClassName = () => {
		return 'text-slate-500 dark:text-slate-400';
	};

	const buildLayerRowsFromStrategy = (
		layerPartitions: StrategyLayerPartition[] | undefined
	): LayerRow[] => {
		if (!Array.isArray(layerPartitions) || layerPartitions.length === 0) {
			throw new Error('切分策略数据未返回，无法渲染逐层分块视图');
		}

		return layerPartitions.map((partition) => {
			if (!Array.isArray(partition.head_assignments) || partition.head_assignments.length === 0) {
				throw new Error(`Layer${partition.layer_id} 的 head_assignments 为空，无法渲染 head 色块`);
			}

			const heads = partition.head_assignments.map((assignment, headIndex) => ({
				index: headIndex + 1,
				owner: ownerFromAssignment(assignment)
			}));

			const edgeHeads =
				typeof partition.edge_head_count === 'number'
					? partition.edge_head_count
					: heads.filter((head) => head.owner === 'edge').length;

			const cloudHeads =
				typeof partition.cloud_head_count === 'number'
					? partition.cloud_head_count
					: heads.length - edgeHeads;

			const ffnOwner = ffnOwnerFromAssignment(partition.ffn_assignment);

			return {
				id: partition.layer_id,
				label: `Layer${partition.layer_id}`,
				heads,
				edgeHeads,
				cloudHeads,
				ffnOwner,
				ffnLabel: getFFNLabel(ffnOwner)
			};
		});
	};

	$: totalLayers = Math.max($collabState.split?.totalLayers ?? 1, 1);
	$: edgePercent = clamp(Math.round($collabState.split?.edgePercent ?? 0), 0, 100);
	$: cloudPercent = clamp(Math.round($collabState.split?.cloudPercent ?? 0), 0, 100);
	$: layerPartitions = $collabState.split?.layerPartitions ?? [];

	$: layerRowsError = '';
	$: layerRows = (() => {
		try {
			layerRowsError = '';
			return buildLayerRowsFromStrategy(layerPartitions);
		} catch (error) {
			layerRowsError = error instanceof Error ? error.message : '切分策略数据异常，无法渲染逐层分块视图';
			return [];
		}
	})();

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
						边云切分详情
					</h1>

					<div
						class="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-[13px] font-medium text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300"
					>
						<span class="mr-2 h-2 w-2 rounded-full bg-current"></span>
						{statusLabel}
					</div>
				</div>
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
				<span class="text-slate-400 dark:text-slate-500">边端占比</span>
				<span class="ml-2 text-lg font-semibold text-slate-900 dark:text-white">{edgePercent}%</span>
			</div>

			<div>
				<span class="text-slate-400 dark:text-slate-500">云端占比</span>
				<span class="ml-2 text-lg font-semibold text-slate-900 dark:text-white">{cloudPercent}%</span>
			</div>

			<div class="flex flex-wrap items-center gap-3">
				<div class="inline-flex items-center gap-2">
					<span class="h-3 w-3 rounded-full bg-[#45B4FF]"></span>
					<span>边端颜色</span>
				</div>

				<div class="inline-flex items-center gap-2">
					<span class="h-3 w-3 rounded-full bg-[#FFB629]"></span>
					<span>云端颜色</span>
				</div>
			</div>
		</div>
	</div>

	{#if layerRowsError}
		<div class="px-4 py-10 md:px-6">
			<div
				class="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm leading-6 text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-300"
			>
				<div class="text-base font-semibold">切分策略数据异常</div>
				<div class="mt-1">{layerRowsError}</div>
				<div class="mt-2 text-red-600/80 dark:text-red-300/80">
					请确认 GET /api/v1/schedule/tasks/&#123;task_id&#125;/strategy 已返回 decision.layer_partitions。
				</div>
			</div>
		</div>
	{:else}
		<div class="px-4 md:px-6">
			{#each visibleRows as row}
				<article class="border-b border-slate-200/75 py-7 last:border-b-0 dark:border-white/8">
					<div class="grid gap-5 xl:grid-cols-[170px_minmax(0,1fr)] xl:items-start">
						<div class="min-w-0">
							<div
								class="mt-2 text-[26px] font-semibold tracking-tight text-slate-900 dark:text-white md:text-[36px]"
							>
								{row.label}
							</div>

							<div class={`mt-3 text-[16px] font-medium ${getFFNClassName(row.ffnOwner)}`}>
								{row.ffnLabel}
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
													? 'border-[#6BC4FF] bg-[linear-gradient(180deg,#76CEFF_0%,#4EAFF8_100%)]'
													: 'border-[#F2C357] bg-[linear-gradient(180deg,#FFD566_0%,#FFC443_100%)]'
											}`}
											style={`height:${HEAD_CELL_HEIGHT}px; border-radius:${HEAD_CELL_RADIUS}px;`}
										>
											<span class="text-[12px] font-semibold uppercase leading-none tracking-[0.06em]">
												HEAD
											</span>

											<span class="mt-1 text-[13px] font-semibold leading-none">
												{head.index}
											</span>
										</div>
									{/each}
								</div>
							</div>
						</div>
					</div>
				</article>
			{/each}
		</div>

		<div
			class="flex flex-col gap-3 border-t border-slate-200/80 px-4 py-4 text-sm text-slate-500 dark:border-white/8 dark:text-slate-400 md:px-6 lg:flex-row lg:items-center lg:justify-between"
		>
			<div>每页展示 6 层，逐层查看接口返回的 head 分配和 FFN 落点。</div>

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
	{/if}
</section>
