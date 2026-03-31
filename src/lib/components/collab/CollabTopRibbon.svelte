<script lang="ts">
	import { fly, fade,slide } from 'svelte/transition';
	import { collabState, setCollabRibbonExpanded } from '$lib/stores/collab';

	$: totalLayers = Math.max($collabState.split.totalLayers ?? 1, 1);
	$: cutLayer = Math.min(Math.max($collabState.split.cutLayer ?? 0, 0), totalLayers - 1);
	$: layerList = Array.from({ length: totalLayers }, (_, i) => i);

	$: edgeLayerCount = Math.max(
		($collabState.edge.endLayer ?? 0) - ($collabState.edge.startLayer ?? 0) + 1,
		0
	);

	$: cloudLayerCount = Math.max(
		($collabState.cloud.endLayer ?? 0) - ($collabState.cloud.startLayer ?? 0) + 1,
		0
	);

	$: edgeWidth = (edgeLayerCount / totalLayers) * 100;
	$: cloudWidth = (cloudLayerCount / totalLayers) * 100;

	$: edgeDeviceLabel = $collabState.edge.device || $collabState.edge.name || 'Edge-A';
	$: cloudDeviceLabel = $collabState.cloud.device || $collabState.cloud.name || 'Cloud';
	$: overallTitle = `总进度 ${$collabState.edge.progress}%`;
	$: overallDesc = '边端与云端正在完成模型切分与加载部署';

	// 让切分点 marker 显示在 cutLayer 对应格子的中间
	$: cutMarkerLeft = ((cutLayer + 0.5) / totalLayers) * 100;
</script>

{#if $collabState.enabled && $collabState.ribbonExpanded}
	<div transition:fade={{ duration: 160 }} class="mt-4 w-full">
		<div
			class="overflow-hidden rounded-[28px] border border-[#E9EDF3] bg-white shadow-[0_10px_30px_rgba(15,23,42,0.06)] dark:border-gray-800 dark:bg-gray-900"
		>
			<!-- 顶部总览 -->
			<div class="px-7 pb-5 pt-6">
				<div class="flex items-start justify-between gap-4">
					<div class="min-w-0">
						<div class="flex items-center gap-3">
							<div
								class="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-sky-500"
							>
								<svg viewBox="0 0 24 24" class="h-6 w-6 fill-none stroke-current stroke-[1.8]">
									<path
										d="M7 18h9a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 6.1 8.7 3.5 3.5 0 0 0 7 18Z"
									/>
									<path d="M7 20v2M11 20v2M15 20v2M5 20h12" />
									<path d="M8.5 13h.01M12 13h.01M15.5 13h.01" />
								</svg>
							</div>

							<div class="min-w-0">
								<div class="text-[18px] font-semibold text-[#1F2937] dark:text-white md:text-[20px]">
									{overallTitle}
								</div>
								<div class="mt-1 text-[14px] text-[#6B7280] dark:text-gray-400 md:text-[15px]">
									{overallDesc}
								</div>
							</div>
						</div>
					</div>

					<button
						type="button"
						class="shrink-0 rounded-xl px-3 py-1.5 text-sm text-[#9CA3AF] transition hover:bg-gray-50 hover:text-[#374151] dark:hover:bg-gray-800 dark:hover:text-gray-200"
						on:click={() => setCollabRibbonExpanded(false)}
					>
						收起
					</button>
				</div>
			</div>

			<!-- 中部双卡片 -->
			<div class="grid grid-cols-1 gap-0 border-t border-[#EEF2F7] lg:grid-cols-2">
				<!-- 边端 -->
				<div class="border-b border-[#EEF2F7] px-7 py-6 lg:border-b-0 lg:border-r">
					<div class="flex items-start justify-between gap-3">
						<div class="min-w-0">
							<div class="flex items-center gap-3">
								<div
									class="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-50 text-sky-500"
								>
									<svg viewBox="0 0 24 24" class="h-5 w-5 fill-none stroke-current stroke-[1.8]">
										<path
											d="M7 18h9a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 6.1 8.7 3.5 3.5 0 0 0 7 18Z"
										/>
										<path d="M7 20v2M11 20v2M15 20v2M5 20h12" />
										<path d="M8.5 13h.01M12 13h.01M15.5 13h.01" />
									</svg>
								</div>

								<div>
									<div class="text-[16px] font-semibold text-[#111827] dark:text-white md:text-[18px]">
										边端 {$collabState.edge.progress}%
									</div>
									<div class="mt-1 text-[14px] text-[#4B5563] dark:text-gray-400 md:text-[15px]">
										设备: {edgeDeviceLabel}
									</div>
								</div>
							</div>
						</div>
					</div>

					<div class="mt-6">
						<div class="relative h-10 overflow-hidden rounded-xl bg-[#EEF2F7] dark:bg-gray-800">
							<div
								class="absolute inset-y-0 left-0 rounded-xl transition-all duration-500"
								style={`
									width:${$collabState.edge.progress}%;
									background: linear-gradient(90deg,#39B5FF 0%,#A8E7DB 100%);
								`}
							></div>
							<div
								class="absolute inset-y-0 left-0 rounded-xl opacity-20"
								style={`
									width:${$collabState.edge.progress}%;
									background-image: repeating-linear-gradient(
										120deg,
										rgba(255,255,255,.55) 0 10px,
										transparent 10px 20px
									);
								`}
							></div>
							<div
								class="absolute right-4 top-1/2 -translate-y-1/2 text-[15px] font-semibold text-[#374151] dark:text-gray-200"
							>
								{$collabState.edge.progress}%
							</div>
						</div>
					</div>

					<div
						class="mt-5 flex flex-wrap items-center justify-between gap-3 text-[14px] text-[#4B5563] dark:text-gray-300 md:text-[15px]"
					>
						<div>状态: {$collabState.edge.status}</div>
					</div>
				</div>

				<!-- 云端 -->
				<div class="px-7 py-6">
					<div class="flex items-start justify-between gap-3">
						<div class="min-w-0">
							<div class="flex items-center gap-3">
								<div
									class="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-50 text-amber-500"
								>
									<svg viewBox="0 0 24 24" class="h-5 w-5 fill-none stroke-current stroke-[1.8]">
										<path
											d="M7 18h9a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 6.1 8.7 3.5 3.5 0 0 0 7 18Z"
										/>
										<path d="M7 20v2M11 20v2M15 20v2M5 20h12" />
										<path d="M8.5 13h.01M12 13h.01M15.5 13h.01" />
									</svg>
								</div>

								<div>
									<div class="text-[16px] font-semibold text-[#111827] dark:text-white md:text-[18px]">
										云端 {$collabState.cloud.progress}%
									</div>
									<div class="mt-1 text-[14px] text-[#4B5563] dark:text-gray-400 md:text-[15px]">
										设备: {cloudDeviceLabel}
									</div>
								</div>
							</div>
						</div>
					</div>

					<div class="mt-6">
						<div class="relative h-10 overflow-hidden rounded-xl bg-[#EEF2F7] dark:bg-gray-800">
							<div
								class="absolute inset-y-0 left-0 rounded-xl transition-all duration-500"
								style={`
									width:${$collabState.cloud.progress}%;
									background: linear-gradient(90deg,#FF9F31 0%,#F5D57D 100%);
								`}
							></div>
							<div
								class="absolute inset-y-0 left-0 rounded-xl opacity-20"
								style={`
									width:${$collabState.cloud.progress}%;
									background-image: repeating-linear-gradient(
										120deg,
										rgba(255,255,255,.55) 0 10px,
										transparent 10px 20px
									);
								`}
							></div>
							<div
								class="absolute right-4 top-1/2 -translate-y-1/2 text-[15px] font-semibold text-[#374151] dark:text-gray-200"
							>
								{$collabState.cloud.progress}%
							</div>
						</div>
					</div>

					<div
						class="mt-5 flex flex-wrap items-center justify-between gap-3 text-[14px] text-[#4B5563] dark:text-gray-300 md:text-[15px]"
					>
						<div>状态: {$collabState.cloud.status}</div>

<!--						<button-->
<!--							type="button"-->
<!--							class="inline-flex items-center gap-1 text-[14px] text-[#4B5563] transition hover:text-[#111827] dark:text-gray-300 dark:hover:text-white"-->
<!--						>-->
<!--							展开详情-->
<!--							<svg viewBox="0 0 20 20" class="h-4 w-4 fill-none stroke-current stroke-2">-->
<!--								<path d="M7 4l6 6-6 6" />-->
<!--							</svg>-->
<!--						</button>-->
					</div>
				</div>
			</div>

			<!-- 底部切分区域 -->
			<div class="px-7 pb-6 pt-5">
				<div class="rounded-[24px] border border-[#EEF2F7] bg-white shadow-[0_4px_18px_rgba(15,23,42,0.04)] dark:border-gray-800 dark:bg-gray-900">
					<!-- 标题栏 -->
					<div class="flex items-center justify-between border-b border-[#EEF2F7] px-5 py-4 dark:border-gray-800">
						<div class="flex items-center gap-3">
							<div
								class="flex h-9 w-9 items-center justify-center rounded-2xl bg-sky-50 text-sky-500 dark:bg-sky-900/20"
							>
								<svg viewBox="0 0 24 24" class="h-5 w-5 fill-none stroke-current stroke-[1.8]">
									<path d="M4 17h16" />
									<path d="M7 17V9" />
									<path d="M12 17V6" />
									<path d="M17 17v-4" />
								</svg>
							</div>

							<div>
								<div class="text-[16px] font-semibold text-[#111827] dark:text-white md:text-[18px]">
									切分方案
								</div>
								<div class="mt-0.5 text-[13px] text-[#6B7280] dark:text-gray-400">
									边端与云端按层协同推理
								</div>
							</div>
						</div>

						<div class="text-[13px] text-[#9CA3AF] dark:text-gray-500">
							切分点 Layer {$collabState.split.cutLayer}
						</div>
					</div>

					<div class="px-5 py-5">
						<div class="rounded-2xl border border-[#EEF2F7] bg-[#FAFBFC] p-4 dark:border-gray-800 dark:bg-gray-950/40">
							<!-- 分层条 -->
							<div class="relative overflow-hidden rounded-xl bg-[#EEF2F7] dark:bg-gray-800">
								<div
									class="absolute inset-y-0 left-0 bg-[linear-gradient(90deg,#39B5FF_0%,#B9E8D8_100%)]"
									style={`width:${edgeWidth}%`}
								></div>

								<div
									class="absolute inset-y-0 right-0 bg-[linear-gradient(90deg,#FF9F31_0%,#F4C35E_100%)]"
									style={`width:${cloudWidth}%`}
								></div>

								<div
									class="pointer-events-none absolute inset-0 opacity-20"
									style="background-image:repeating-linear-gradient(120deg,rgba(255,255,255,.58)_0_10px,transparent_10px_20px);"
								></div>

								<div
									class="pointer-events-none absolute inset-0 grid"
									style={`grid-template-columns: repeat(${totalLayers}, minmax(0, 1fr));`}
								>
									{#each layerList as layer}
										<div class={layer !== totalLayers - 1 ? 'border-r border-white/30' : ''}></div>
									{/each}
								</div>

								<div
									class="pointer-events-none absolute inset-y-0 z-[2] w-[3px] bg-white/95 shadow-[0_0_0_1px_rgba(255,255,255,.85)]"
									style={`left: calc(${edgeWidth}% - 1.5px);`}
								></div>

								<div class="relative flex h-10 w-full items-center justify-between px-4">
									<div class="text-[13px] font-semibold text-white md:text-[14px]">
										L{$collabState.edge.startLayer}-L{$collabState.edge.endLayer} 边端
									</div>

									<div class="text-[13px] font-semibold text-white md:text-[14px]">
										L{$collabState.cloud.startLayer}-L{$collabState.cloud.endLayer} 云端
									</div>
								</div>
							</div>

							<!-- 层编号 + 浮动切分点 -->
							<div class="relative mt-4 overflow-visible">
								<div
									class="grid items-center text-center text-[13px] text-[#6B7280] md:text-[15px]"
									style={`grid-template-columns: repeat(${totalLayers}, minmax(0, 1fr));`}
								>
									{#each layerList as layer}
										<div class="flex justify-center">
											<span>{layer}</span>
										</div>
									{/each}
								</div>

								<div
									class="pointer-events-none absolute top-1/2 z-10 -translate-x-1/2 -translate-y-1/2"
									style={`left:${cutMarkerLeft}%`}
								>
									<div
										class="flex h-8 min-w-[36px] items-center justify-center rounded-full border border-[#FED7AA] bg-[#FFF7ED] px-2 text-[15px] font-semibold leading-none whitespace-nowrap tabular-nums text-[#F59E0B] shadow-sm"
									>
										{cutLayer}
									</div>
								</div>
							</div>
						</div>

						<!-- 底部指标 -->
						<div
							class="mt-4 flex flex-wrap items-center justify-center gap-3 rounded-xl bg-[#FAFBFC] px-4 py-3 text-[14px] text-[#4B5563] dark:bg-gray-950/40 dark:text-gray-300"
						>
							<span>切分点 Layer {$collabState.split.cutLayer}</span>
							<span class="text-[#D1D5DB]">|</span>
							<span>策略 {$collabState.split.strategy}</span>
							<span class="text-[#D1D5DB]">|</span>
							<span>RTT {$collabState.network.rttMs} ms</span>
							<span class="text-[#D1D5DB]">|</span>
							<span>带宽 {$collabState.network.bandwidthMbps} Mbps</span>
							{#if $collabState.network.status}
								<span class="text-[#D1D5DB]">|</span>
								<span>链路 {$collabState.network.status}</span>
							{/if}
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}