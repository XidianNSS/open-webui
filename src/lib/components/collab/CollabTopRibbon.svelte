<script lang="ts">
	import { fade } from 'svelte/transition';
	import { collabState, setCollabRibbonExpanded } from '$lib/stores/collab';
	import Collaboration from './Collaboration.svelte';

	const clamp = (value: number, min: number, max: number) => {
		return Math.min(Math.max(value, min), max);
	};

	$: totalLayers = Math.max($collabState.split?.totalLayers ?? 1, 1);

	// 只有 strategy 真正加载出来后，才显示负载占比
	$: hasStrategyPercent =
		typeof $collabState.split?.edgeHeadCountTotal === 'number' &&
		typeof $collabState.split?.cloudHeadCountTotal === 'number';

	$: edgePercent = hasStrategyPercent
		? clamp(Number(($collabState.split?.edgePercent ?? 0).toFixed(1)), 0, 100)
		: 0;

	$: cloudPercent = hasStrategyPercent
		? clamp(Number(($collabState.split?.cloudPercent ?? 0).toFixed(1)), 0, 100)
		: 0;

	$: overallProgress = Math.max(
		$collabState.overallProgress ?? Math.max($collabState.edge.progress, $collabState.cloud.progress),
		0
	);

	// strategy 未返回前，大条按 overallProgress 走；返回后切换成边端/云端占比
	$: loadingBarWidth = clamp(overallProgress, 0, 100);

	$: totalPercent = Math.max(edgePercent + cloudPercent, 1);
	$: edgeWidth = hasStrategyPercent ? (edgePercent / totalPercent) * 100 : 0;
	$: cloudWidth = hasStrategyPercent ? (cloudPercent / totalPercent) * 100 : 0;

	$: edgeDeviceLabel = $collabState.edge.device || $collabState.edge.name || 'Edge-A';
	$: cloudDeviceLabel = $collabState.cloud.device || $collabState.cloud.name || 'Cloud-B';

	$: overallStatusLabel = overallProgress >= 100 ? '已就绪' : '准备中';
	$: networkStatusLabel =
		$collabState.network.status === 'connected'
			? '已连接'
			: $collabState.network.status === 'connecting'
				? '连接中'
				: '未连接';
</script>

{#if $collabState.enabled && $collabState.ribbonExpanded}
	<div transition:fade={{ duration: 160 }} class="mt-2.5 w-full">
		<section
			class="overflow-hidden rounded-[22px] border border-[#E7ECF3] bg-white/95 shadow-[0_16px_38px_rgba(15,23,42,0.07)] backdrop-blur dark:border-white/8 dark:bg-[#10161F]/92 dark:shadow-[0_18px_44px_rgba(0,0,0,0.34)]"
		>
			<div
				class="flex flex-wrap items-start justify-between gap-3 border-b border-[#EEF2F6] px-5 py-4 dark:border-white/8 md:px-6"
			>
				<div class="min-w-0 flex items-start gap-3">
					<div
						class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-sky-100 bg-sky-50 text-sky-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] dark:border-sky-400/20 dark:bg-sky-400/10 dark:text-sky-300"
					>
						<Collaboration className="h-5 w-5" strokeWidth="1.85" />
					</div>

					<div class="min-w-0">
						<div class="flex flex-wrap items-center gap-2">
							<h2 class="text-[17px] font-semibold text-[#18212F] dark:text-white md:text-[18px]">
								边云协同
							</h2>
							<div
								class="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-[12px] font-medium text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300"
							>
								<span class="mr-1.5 h-1.5 w-1.5 rounded-full bg-current"></span>
								{overallStatusLabel} {overallProgress}%
							</div>
						</div>

						<div class="mt-1 text-[12px] text-[#667085] dark:text-gray-400 md:text-[13px]">
							{$collabState.message}
						</div>
					</div>
				</div>

				<div class="flex items-center gap-2">
					{#if hasStrategyPercent}
						<div
							class="inline-flex items-center rounded-full border border-[#E7ECF3] bg-white/85 px-2.5 py-1 text-[12px] text-[#475467] shadow-sm dark:border-white/8 dark:bg-white/[0.04] dark:text-gray-300"
						>
							边端 {edgePercent}% / 云端 {cloudPercent}%
						</div>
					{/if}

					<button
						type="button"
						class="shrink-0 rounded-xl px-3 py-1.5 text-sm text-[#98A2B3] transition hover:bg-black/[0.04] hover:text-[#344054] dark:hover:bg-white/5 dark:hover:text-gray-200"
						on:click={() => setCollabRibbonExpanded(false)}
					>
						收起
					</button>
				</div>
			</div>

			<div class="px-5 pb-5 pt-4 md:px-6">
				<div class="grid gap-3 md:grid-cols-2">
					<div
						class="rounded-[18px] border border-[#EAEFF5] bg-[#FBFCFE] p-4 dark:border-white/8 dark:bg-white/[0.03]"
					>
						<div class="flex items-start justify-between gap-3">
							<div class="flex items-start gap-3">
								<div
									class="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-sky-100 bg-sky-50 text-sky-500 dark:border-sky-400/20 dark:bg-sky-400/10 dark:text-sky-300"
								>
									<svg viewBox="0 0 24 24" class="h-4.5 w-4.5 fill-none stroke-current stroke-[1.85]">
										<rect x="7.25" y="7.25" width="9.5" height="9.5" rx="2.2" />
										<path d="M9.5 4.5v2M14.5 4.5v2M9.5 17.5v2M14.5 17.5v2M4.5 9.5h2M4.5 14.5h2M17.5 9.5h2M17.5 14.5h2" />
									</svg>
								</div>

								<div class="min-w-0">
									<div class="text-[15px] font-semibold text-[#18212F] dark:text-white">
										边端
									</div>
									<div class="mt-1 text-[12px] text-[#667085] dark:text-gray-400">
										设备: {edgeDeviceLabel}
									</div>
								</div>
							</div>

							<div class="text-[16px] font-semibold tabular-nums text-[#18212F] dark:text-white">
								{$collabState.edge.progress}%
							</div>
						</div>

						<div class="mt-3 h-2.5 overflow-hidden rounded-full bg-[#EAF0F6] dark:bg-white/8">
							<div
								class="h-full rounded-full transition-all duration-500 ease-out"
								style={`width:${$collabState.edge.progress}%;background:linear-gradient(90deg,#39B5FF 0%,#A9E6DA 100%);`}
							></div>
						</div>

						<div class="mt-3 text-[12px] text-[#475467] dark:text-gray-300">
							状态: {$collabState.edge.status}
						</div>
					</div>

					<div
						class="rounded-[18px] border border-[#EAEFF5] bg-[#FBFCFE] p-4 dark:border-white/8 dark:bg-white/[0.03]"
					>
						<div class="flex items-start justify-between gap-3">
							<div class="flex items-start gap-3">
								<div
									class="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-amber-100 bg-amber-50 text-amber-500 dark:border-amber-300/20 dark:bg-amber-300/10 dark:text-amber-300"
								>
									<svg viewBox="0 0 24 24" class="h-4.5 w-4.5 fill-none stroke-current stroke-[1.85]">
										<path
											d="M7.25 17.5h8.25a3.75 3.75 0 0 0 .5-7.46 5.2 5.2 0 0 0-9.9-1.3A3.2 3.2 0 0 0 7.25 17.5Z"
										/>
										<path d="M8.75 20h6.5" />
									</svg>
								</div>

								<div class="min-w-0">
									<div class="text-[15px] font-semibold text-[#18212F] dark:text-white">
										云端
									</div>
									<div class="mt-1 text-[12px] text-[#667085] dark:text-gray-400">
										设备: {cloudDeviceLabel}
									</div>
								</div>
							</div>

							<div class="text-[16px] font-semibold tabular-nums text-[#18212F] dark:text-white">
								{$collabState.cloud.progress}%
							</div>
						</div>

						<div class="mt-3 h-2.5 overflow-hidden rounded-full bg-[#FFF0D9] dark:bg-white/8">
							<div
								class="h-full rounded-full transition-all duration-500 ease-out"
								style={`width:${$collabState.cloud.progress}%;background:linear-gradient(90deg,#FF9F31 0%,#FFD97A 100%);`}
							></div>
						</div>

						<div class="mt-3 text-[12px] text-[#475467] dark:text-gray-300">
							状态: {$collabState.cloud.status}
						</div>
					</div>
				</div>

				<div
					class="mt-3 rounded-[18px] border border-[#EAEFF5] bg-[#FBFCFE] p-4 dark:border-white/8 dark:bg-white/[0.03]"
				>
					<div class="flex flex-wrap items-start justify-between gap-3">
						<div>
							<div class="text-[14px] font-semibold text-[#18212F] dark:text-white">
								切分推理策略
							</div>
							<div class="mt-1 text-[12px] text-[#667085] dark:text-gray-400">
								边端与云端按推理占比协同分担计算任务
							</div>
						</div>

						<div class="flex flex-wrap gap-2">
							{#if hasStrategyPercent}
								<div
									class="rounded-full border border-[#E7ECF3] bg-white/85 px-2.5 py-1 text-[12px] text-[#475467] shadow-sm dark:border-white/8 dark:bg-white/[0.04] dark:text-gray-300"
								>
									边端 {edgePercent}%
								</div>
								<div
									class="rounded-full border border-[#E7ECF3] bg-white/85 px-2.5 py-1 text-[12px] text-[#475467] shadow-sm dark:border-white/8 dark:bg-white/[0.04] dark:text-gray-300"
								>
									云端 {cloudPercent}%
								</div>
							{/if}

							<div
								class="rounded-full border border-[#E7ECF3] bg-white/85 px-2.5 py-1 text-[12px] text-[#475467] shadow-sm dark:border-white/8 dark:bg-white/[0.04] dark:text-gray-300"
							>
								链路 {networkStatusLabel}
							</div>
						</div>
					</div>

					<div
						class="mt-4 rounded-[16px] border border-[#ECF1F6] bg-white p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.95)] dark:border-white/8 dark:bg-[#0B1118]"
					>
						<div class="relative overflow-hidden rounded-2xl bg-[#EAF0F6] shadow-sm dark:bg-white/8">
							<div
								class="absolute inset-y-0 left-0 rounded-2xl bg-[linear-gradient(90deg,#DCE6F2_0%,#EEF3F8_100%)] transition-all duration-500 ease-out dark:bg-[linear-gradient(90deg,rgba(255,255,255,0.12)_0%,rgba(255,255,255,0.06)_100%)]"
								style={`width:${loadingBarWidth}%;opacity:${hasStrategyPercent ? 0 : 1};`}
							></div>

							<div
								class="absolute inset-y-0 left-0 bg-[linear-gradient(90deg,#39B5FF_0%,#B9E8D8_100%)] transition-all duration-500 ease-out"
								style={`width:${edgeWidth}%;opacity:${hasStrategyPercent ? 1 : 0};`}
							></div>

							<div
								class="absolute inset-y-0 right-0 bg-[linear-gradient(90deg,#FF9F31_0%,#F4C35E_100%)] transition-all duration-500 ease-out"
								style={`width:${cloudWidth}%;opacity:${hasStrategyPercent ? 1 : 0};`}
							></div>

							<div
								class="pointer-events-none absolute inset-0 opacity-15 transition-opacity duration-500 ease-out"
								style={`background-image:repeating-linear-gradient(120deg,rgba(255,255,255,.42)_0_10px,transparent_10px_20px);opacity:${hasStrategyPercent ? 0.15 : 0};`}
							></div>

							<div
								class="pointer-events-none absolute inset-y-1.5 z-[2] w-[2px] rounded-full bg-white/90 shadow-[0_0_0_1px_rgba(255,255,255,.45)] transition-all duration-500 ease-out"
								style={`left: calc(${edgeWidth}% - 1px);opacity:${hasStrategyPercent && edgeWidth > 0 && cloudWidth > 0 ? 1 : 0};`}
							></div>

							<div class="relative flex h-14">
								<div
									class="flex items-center px-5 text-[13px] font-semibold text-white transition-all duration-500 ease-out"
									style={`width:${hasStrategyPercent ? edgeWidth : 0}%;opacity:${hasStrategyPercent ? 1 : 0};`}
								>
									<span class="truncate drop-shadow-sm">边端 {edgePercent}%</span>
								</div>

								<div
									class="flex items-center justify-end px-5 text-[13px] font-semibold text-white transition-all duration-500 ease-out"
									style={`width:${hasStrategyPercent ? cloudWidth : 0}%;opacity:${hasStrategyPercent ? 1 : 0};`}
								>
									<span class="truncate drop-shadow-sm">云端 {cloudPercent}%</span>
								</div>
							</div>
						</div>

						<div
							class="mt-3 flex flex-wrap items-center justify-between gap-2 text-[12px] text-[#667085] transition-all duration-500 ease-out dark:text-gray-400"
							style={`opacity:${hasStrategyPercent ? 1 : 0};max-height:${hasStrategyPercent ? '40px' : '0px'};overflow:hidden;`}
						>
							<div class="flex items-center gap-2">
								<span class="inline-block h-2.5 w-2.5 rounded-full bg-sky-400"></span>
								<span>边端承担 {edgePercent}% 推理负载</span>
							</div>

							<div class="flex items-center gap-2">
								<span class="inline-block h-2.5 w-2.5 rounded-full bg-amber-400"></span>
								<span>云端承担 {cloudPercent}% 推理负载</span>
							</div>
						</div>
					</div>
				</div>
			</div>
		</section>
	</div>
{/if}