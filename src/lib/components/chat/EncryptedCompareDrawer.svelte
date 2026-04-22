<script lang="ts">
	export let open = false;

	export let panelData: {
		inputText: string;
		encryptedText: string;
		modelCipherText: string;
		decryptedText: string;
		status: 'idle' | 'encrypting' | 'generating' | 'decrypting' | 'done';
	} = {
		inputText: '',
		encryptedText: '',
		modelCipherText: '',
		decryptedText: '',
		status: 'idle'
	};

	const demoData = {
		inputText: '请对这句话进行处理，并输出一段表达完整、意思清楚的结果。',
		encryptedText: `seg_01 :: ka9r-xt2m-4qv7 :: mΔx#u1
blk_02 :: p8vf-21zr-x4aa :: 7L!m_k
seg_03 :: n7q2-pt8e-zz1c :: φh@3_y
mix_04 :: r4av-11pd-qk2s :: h2*_y_t`,
		modelCipherText: `rsp_01 :: q7e2-lv9a-dm3r :: 2#k_tg
rsp_02 :: z1p8-hq5m-vx4c :: eμ@19
rsp_03 :: t6s1-af8k-jr0q :: 44l_yu
rsp_04 :: y2d7-ne4w-kp9t :: ξm!0_o`,
		decryptedText: '这句话已经完成处理，最终结果以自然语言形式恢复，可直接被用户理解和查看。',
		status: 'done' as const
	};

	const steps = [
		{ no: '01', title: '输入明文', desc: '用户最初看到的是正常内容' },
		{ no: '02', title: '客户端加密', desc: '内容转成不可直接读懂的文字' },
		{ no: '03', title: '模型输出', desc: '输出结果仍然是不可读文字' },
		{ no: '04', title: '客户端解密', desc: '恢复为正常可读内容' }
	];

	const statusMap = {
		idle: '等待提问',
		encrypting: '客户端加密中',
		generating: '模型输出中',
		decrypting: '客户端解密中',
		done: '展示完成'
	};

	$: hasRuntimeData =
		!!panelData.inputText ||
		!!panelData.encryptedText ||
		!!panelData.modelCipherText ||
		!!panelData.decryptedText;

	$: displayData = hasRuntimeData ? panelData : demoData;
</script>

<div
	class:hidden={!open}
	class="h-full w-[420px] shrink-0 border-l border-slate-200/80 bg-[#fbfcfe]/96 backdrop-blur-md shadow-[-16px_0_40px_rgba(15,23,42,0.08)] overflow-hidden"
>
	<div class="flex h-full flex-col">
		<div class="border-b border-slate-200/80 px-5 pt-5 pb-4 bg-white/80">
			<div class="flex items-start justify-between gap-3">
				<div>
					<div class="text-[15px] font-semibold tracking-[0.01em] text-slate-900">
						密态过程展示
					</div>
					<div class="mt-1 text-xs leading-5 text-slate-500">
						先看顺序，再看哪些内容可读，哪些内容不可读
					</div>
				</div>

				<button
					class="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
					on:click={() => (open = false)}
					aria-label="关闭抽屉"
					title="关闭"
				>
					✕
				</button>
			</div>

			<div class="mt-4 grid grid-cols-2 gap-3">
				{#each steps as step}
					<div class="rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-[0_6px_20px_rgba(15,23,42,0.03)]">
						<div class="flex items-center gap-3">
							<div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[12px] font-semibold text-blue-700 ring-1 ring-blue-100">
								{step.no}
							</div>
							<div class="min-w-0">
								<div class="text-[13px] font-semibold text-slate-900">{step.title}</div>
								<div class="mt-0.5 text-[11px] leading-4 text-slate-500">
									{step.desc}
								</div>
							</div>
						</div>
						<div class="mt-3 h-[2px] w-full rounded-full bg-gradient-to-r from-blue-200 via-violet-100 to-emerald-100"></div>
					</div>
				{/each}
			</div>
		</div>

		<div class="flex-1 overflow-y-auto px-5 py-5 space-y-5">
			<div class="rounded-[28px] border border-emerald-100 bg-gradient-to-br from-emerald-50/95 to-cyan-50/70 p-4 shadow-[0_10px_30px_rgba(16,185,129,0.06)]">
				<div class="flex items-center justify-between gap-3">
					<div>
						<div class="text-[15px] font-semibold text-slate-900">可读内容区</div>
						<div class="mt-1 text-xs leading-5 text-slate-500">
							这里放的是可以直接阅读的内容：原始输入，以及客户端解密后恢复出的结果。
						</div>
					</div>

					<div class="rounded-full border border-emerald-200 bg-white/80 px-3 py-1 text-[11px] font-medium text-slate-600">
						明文 / 恢复结果
					</div>
				</div>

				<div class="mt-4 space-y-4">
					<div class="rounded-[24px] border border-slate-200/80 bg-white/92 p-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
						<div class="mb-3 flex items-center justify-between gap-3">
							<div class="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-600">
								步骤 01 · 客户端输入内容
							</div>
							<div class="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-100">
								可读
							</div>
						</div>

						<div class="text-[15px] font-semibold text-slate-900">原始输入</div>
						<div class="mt-2 text-[13px] leading-6 text-slate-500">
							页面起点是用户正常输入的一句话，可以直接理解，不需要额外处理。
						</div>

						<div class="mt-4 rounded-[20px] border border-slate-200 bg-slate-50/80 px-4 py-4 text-[14px] leading-7 text-slate-800 whitespace-pre-wrap">
							{displayData.inputText}
						</div>
					</div>

					<div class="rounded-[24px] border border-slate-200/80 bg-white/92 p-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
						<div class="mb-3 flex items-center justify-between gap-3">
							<div class="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-600">
								步骤 04 · 客户端解密后内容
							</div>
							<div class="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-100">
								可读
							</div>
						</div>

						<div class="text-[15px] font-semibold text-slate-900">恢复结果</div>
						<div class="mt-2 text-[13px] leading-6 text-slate-500">
							最终结果只有在客户端完成解密之后，才会恢复成正常自然语言。
						</div>

						<div class="mt-4 rounded-[20px] border border-slate-200 bg-slate-50/80 px-4 py-4 text-[14px] leading-7 text-slate-800 whitespace-pre-wrap">
							{displayData.decryptedText}
						</div>
					</div>
				</div>
			</div>

			<div class="rounded-[28px] border border-violet-100 bg-gradient-to-br from-indigo-50/90 to-violet-50/75 p-4 shadow-[0_10px_30px_rgba(99,102,241,0.06)]">
				<div class="flex items-center justify-between gap-3">
					<div>
						<div class="text-[15px] font-semibold text-slate-900">不可读内容区</div>
						<div class="mt-1 text-xs leading-5 text-slate-500">
							这里放的是暂时无法直接理解的内容：加密后的中间结果，以及模型输出的不可读文字。
						</div>
					</div>

					<div class="rounded-full border border-violet-200 bg-white/80 px-3 py-1 text-[11px] font-medium text-slate-600">
						中间结果 / 模型输出
					</div>
				</div>

				<div class="mt-4 space-y-4">
					<div class="rounded-[24px] border border-slate-200/80 bg-white/92 p-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
						<div class="mb-3 flex items-center justify-between gap-3">
							<div class="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-600">
								步骤 02 · 加密后中间结果
							</div>
							<div class="rounded-full bg-blue-50 px-3 py-1 text-[11px] font-semibold text-blue-700 ring-1 ring-blue-100">
								不可读
							</div>
						</div>

						<div class="text-[15px] font-semibold text-slate-900">客户端加密后</div>
						<div class="mt-2 text-[13px] leading-6 text-slate-500">
							内容已经由正常语言转换成一段语言不通的文字，当前阶段无法直接阅读。
						</div>

						<div class="mt-4 rounded-[20px] border border-blue-100 bg-[linear-gradient(180deg,#f7f9ff_0%,#f9fbff_100%)] px-4 py-4 font-mono text-[12px] leading-7 text-blue-800 whitespace-pre-wrap break-all">
							{displayData.encryptedText}
						</div>
					</div>

					<div class="rounded-[24px] border border-slate-200/80 bg-white/92 p-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
						<div class="mb-3 flex items-center justify-between gap-3">
							<div class="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-600">
								步骤 03 · 模型输出内容
							</div>
							<div class="rounded-full bg-blue-50 px-3 py-1 text-[11px] font-semibold text-blue-700 ring-1 ring-blue-100">
								不可读
							</div>
						</div>

						<div class="text-[15px] font-semibold text-slate-900">输出结果</div>
						<div class="mt-2 text-[13px] leading-6 text-slate-500">
							大模型输出的结果仍然保持为不可直接理解的文字，还没有恢复成正常表达。
						</div>

						<div class="mt-4 rounded-[20px] border border-blue-100 bg-[linear-gradient(180deg,#f7f9ff_0%,#f9fbff_100%)] px-4 py-4 font-mono text-[12px] leading-7 text-blue-800 whitespace-pre-wrap break-all">
							{displayData.modelCipherText}
						</div>
					</div>
				</div>
			</div>
		</div>

		<div class="border-t border-slate-200/80 bg-white/85 px-5 py-4">
			<div class="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
				<div class="text-xs text-slate-500">当前状态</div>
				<div class="mt-1 text-sm font-semibold text-slate-800">
					{statusMap[displayData.status]}
				</div>
			</div>
		</div>
	</div>
</div>