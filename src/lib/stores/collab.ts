import { writable } from 'svelte/store';

export type CollabPhase =
	| 'idle'
	| 'planning'
	| 'edge_loading'
	| 'cloud_loading'
	| 'handshaking'
	| 'ready'
	| 'failed';

export type BackendTaskStatus = 'idle' | 'accepted' | 'running' | 'completed' | 'failed';
export type BackendTaskPhase = 'idle' | 'strategy' | 'loading' | 'completed';

// 描述后端返回的数据格式
export interface BackendTask {
	task_id: string;
	status: Exclude<BackendTaskStatus, 'idle'>;
	phase: Exclude<BackendTaskPhase, 'idle'>;
	phase_progress: number;
	overall_progress: number;
	message: string;
	edge_progress?: number;
	cloud_progress?: number;
	edge_status?: string;
	cloud_status?: string;
	edge_message?: string;
	cloud_message?: string;
	error_detail?: string | null;
	created_at?: string;
	updated_at?: string;
}

export interface StrategyLayerPartition {
	layer_id: number;
	head_assignments: number[];
	ffn_assignment: number;
	edge_head_count: number;
	cloud_head_count: number;
}

export interface TaskStrategyDecision {
	edge_head_count_total?: number;
	cloud_head_count_total?: number;
	layer_partitions?: StrategyLayerPartition[];
}

export interface TaskStrategyResponse {
	task_id: string;
	model_type: string;
	decision: TaskStrategyDecision;
}

export interface CollabNodeState {
	name: string;
	device: string;
	progress: number;
	status: string;
	startLayer: number;
	endLayer: number;
}

// 描述前端 store 里完整的状态结构
export interface CollabState {
	enabled: boolean;
	mode: 'single' | 'edge_cloud';
	ribbonExpanded: boolean;
	phase: CollabPhase;
	overallProgress: number;

	token: string | null;
	taskId: string | null;
	backendStatus: BackendTaskStatus;
	backendPhase: BackendTaskPhase;
	message: string;

	edge: CollabNodeState;
	cloud: CollabNodeState;

	split: {
		cutLayer: number;
		strategy: string;
		totalLayers: number;
		edgePercent: number;
		cloudPercent: number;
		edgeRange: string;
		cloudRange: string;
		currentLayer: number;

		edgeHeadCountTotal?: number;
		cloudHeadCountTotal?: number;
		totalHeadCount?: number;
		modelType?: string;
		layerPartitions?: StrategyLayerPartition[];
	};

	network: {
		rttMs: number;
		bandwidthMbps: number;
		status: 'disconnected' | 'connecting' | 'connected';
	};

	error: string | null;
}

type MockFailStage = 'none' | 'login' | 'trigger' | 'strategy' | 'loading';

const isBrowser = typeof window !== 'undefined';

const RAW_BASE = (import.meta.env.VITE_CLOUD_API_BASE ?? 'http://10.144.144.2:8010').replace(
	/\/+$/,
	''
);
const API_BASE = RAW_BASE.endsWith('/api/v1') ? RAW_BASE : `${RAW_BASE}/api/v1`;

const USE_MOCK_CLOUD_API = (import.meta.env.VITE_USE_MOCK_CLOUD_API ?? 'true') === 'true';
const MOCK_FAIL_STAGE = (import.meta.env.VITE_MOCK_CLOUD_FAIL_STAGE ?? 'none') as MockFailStage;

const OPENWEBUI_TOKEN_KEY = 'token';
const CLOUD_TOKEN_KEY = 'cloud_access_token';

const clamp = (value: number, min: number, max: number) => {
	return Math.min(Math.max(value, min), max);
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const normalizeSplitPercents = ({
	edgePercent,
	cloudPercent,
	cutLayer,
	totalLayers
}: {
	edgePercent?: number;
	cloudPercent?: number;
	cutLayer: number;
	totalLayers: number;
}) => {
	const safeTotalLayers = Math.max(totalLayers, 1);
	const fallbackEdgePercent = Math.round(
		(clamp(cutLayer, 0, safeTotalLayers) / safeTotalLayers) * 100
	);

	let resolvedEdgePercent =
		typeof edgePercent === 'number'
			? edgePercent
			: typeof cloudPercent === 'number'
				? 100 - cloudPercent
				: fallbackEdgePercent;

	resolvedEdgePercent = clamp(Math.round(resolvedEdgePercent), 0, 100);

	let resolvedCloudPercent =
		typeof cloudPercent === 'number' ? cloudPercent : 100 - resolvedEdgePercent;

	resolvedCloudPercent = clamp(Math.round(resolvedCloudPercent), 0, 100);

	if (resolvedEdgePercent + resolvedCloudPercent !== 100) {
		resolvedCloudPercent = 100 - resolvedEdgePercent;
	}

	return {
		edgePercent: resolvedEdgePercent,
		cloudPercent: resolvedCloudPercent
	};
};

const summarizeStrategyDecision = (decision?: TaskStrategyDecision) => {
	const layerPartitions = Array.isArray(decision?.layer_partitions)
		? decision.layer_partitions
		: [];

	const edgeHeadCountTotal =
		typeof decision?.edge_head_count_total === 'number'
			? decision.edge_head_count_total
			: layerPartitions.reduce((sum, item) => sum + (item.edge_head_count ?? 0), 0);

	const cloudHeadCountTotal =
		typeof decision?.cloud_head_count_total === 'number'
			? decision.cloud_head_count_total
			: layerPartitions.reduce((sum, item) => sum + (item.cloud_head_count ?? 0), 0);

	const totalHeadCount = edgeHeadCountTotal + cloudHeadCountTotal;

	const edgePercent =
		totalHeadCount > 0 ? clamp(Math.round((edgeHeadCountTotal / totalHeadCount) * 100), 0, 100) : 0;

	const cloudPercent = totalHeadCount > 0 ? 100 - edgePercent : 0;

	return {
		edgeHeadCountTotal,
		cloudHeadCountTotal,
		totalHeadCount,
		edgePercent,
		cloudPercent,
		totalLayers: Math.max(layerPartitions.length, 1),
		layerPartitions
	};
};

const getOpenWebUIToken = () => {
	if (!isBrowser) return null;
	return window.localStorage.getItem(OPENWEBUI_TOKEN_KEY) ?? null;
};

const getCloudToken = () => {
	if (!isBrowser) return null;
	return window.localStorage.getItem(CLOUD_TOKEN_KEY) ?? null;
};

const setRuntimeToken = (token: string | null) => {
	collabState.update((s) => ({
		...s,
		token
	}));
};

const setCloudToken = (token: string | null) => {
	if (!isBrowser) return;

	if (token) {
		window.localStorage.setItem(CLOUD_TOKEN_KEY, token);
	} else {
		window.localStorage.removeItem(CLOUD_TOKEN_KEY);
	}
};

const parseJsonSafely = async (res: Response) => {
	try {
		return await res.json();
	} catch {
		return null;
	}
};

const extractErrorMessage = (data: any, fallback: string) => {
	return data?.detail || data?.message || data?.error_detail || fallback;
};

const createDefaultSplit = (cutLayer = 16, totalLayers = 32) => {
	const safeTotalLayers = Math.max(totalLayers, 1);
	const safeCutLayer = clamp(Math.round(cutLayer), 0, safeTotalLayers);
	const { edgePercent, cloudPercent } = normalizeSplitPercents({
		cutLayer: safeCutLayer,
		totalLayers: safeTotalLayers
	});

	return {
		cutLayer: safeCutLayer,
		strategy: '待计算',
		totalLayers: safeTotalLayers,
		edgePercent,
		cloudPercent,
		edgeRange: `L0-L${Math.max(safeCutLayer - 1, 0)}`,
		cloudRange: `L${safeCutLayer}-L${Math.max(safeTotalLayers - 1, 0)}`,
		currentLayer: safeCutLayer,
		edgeHeadCountTotal: undefined,
		cloudHeadCountTotal: undefined,
		totalHeadCount: undefined,
		modelType: undefined,
		layerPartitions: []
	};
};

const initialSplit = createDefaultSplit();

const initialState: CollabState = {
	enabled: false,
	mode: 'single',
	ribbonExpanded: false,
	phase: 'idle',
	overallProgress: 0,

	token: getCloudToken(),
	taskId: null,
	backendStatus: 'idle',
	backendPhase: 'idle',
	message: '',

	edge: {
		name: '边端模型',
		device: 'Edge-A',
		progress: 0,
		status: '',
		startLayer: 0,
		endLayer: 15
	},
	cloud: {
		name: '云端模型',
		device: 'Cloud-B',
		progress: 0,
		status: '',
		startLayer: 16,
		endLayer: 31
	},
	split: initialSplit,
	network: {
		rttMs: 0,
		bandwidthMbps: 0,
		status: 'disconnected'
	},
	error: null
};

export const collabState = writable<CollabState>({ ...initialState });

let timers: number[] = [];
let pollTimer: number | null = null;

const strategyLoadedTaskIds = new Set<string>();
const strategyLoadingTaskIds = new Set<string>();

const clearTimers = () => {
	if (!isBrowser) return;
	timers.forEach((id) => window.clearTimeout(id));
	timers = [];
};

export const stopTaskPolling = () => {
	if (!isBrowser || pollTimer === null) return;
	window.clearTimeout(pollTimer);
	pollTimer = null;
};

export const resetCollabState = () => {
	clearTimers();
	stopTaskPolling();
	strategyLoadedTaskIds.clear();
	strategyLoadingTaskIds.clear();
	collabState.set({
		...initialState,
		token: getCloudToken()
	});
};

export const setCollabRibbonExpanded = (expanded: boolean) => {
	collabState.update((s) => ({ ...s, ribbonExpanded: expanded }));
};

export const toggleCollabRibbon = () => {
	collabState.update((s) => ({ ...s, ribbonExpanded: !s.ribbonExpanded }));
};

export const clearCloudToken = () => {
	setCloudToken(null);
	collabState.update((s) => ({
		...s,
		token: null
	}));
};

export const hasStoredCloudToken = () => {
	return Boolean(getCloudToken());
};

const getAuthorizedHeaders = () => {
	const token = getCloudToken();

	if (!token) {
		throw new Error('云端调度 token 不存在，请先完成 token exchange');
	}

	return {
		Authorization: `Bearer ${token}`
	};
};

const inferUiPhase = (task: BackendTask): CollabPhase => {
	if (task.status === 'failed') return 'failed';
	if (task.status === 'completed') return 'ready';
	if (task.phase === 'strategy') return 'planning';
	if (task.phase === 'loading') return 'cloud_loading';
	return 'idle';
};

const buildNodeStatus = (
	phase: BackendTask['phase'],
	message: string,
	nodeStatus: string | undefined,
	nodeMessage: string | undefined,
	fallback: string
) => {
	if (phase === 'strategy') return '等待切分策略';
	return nodeMessage || nodeStatus || message || fallback;
};

export const applyTaskToStore = (task: BackendTask) => {
	const STRATEGY_PORTION = 30;
	const LOADING_PORTION = 100 - STRATEGY_PORTION;

	const phaseProgress = clamp(task.phase_progress ?? 0, 0, 100);
	const rawEdgeProgress = clamp(task.edge_progress ?? 0, 0, 100);
	const rawCloudProgress = clamp(task.cloud_progress ?? 0, 0, 100);

	let edgeProgress = 0;
	let cloudProgress = 0;

	if (task.status === 'completed') {
		edgeProgress = 100;
		cloudProgress = 100;
	} else if (task.phase === 'strategy') {
		const strategyMapped = Math.round((phaseProgress / 100) * STRATEGY_PORTION);
		edgeProgress = strategyMapped;
		cloudProgress = strategyMapped;
	} else if (task.phase === 'loading') {
		edgeProgress = STRATEGY_PORTION + Math.round((rawEdgeProgress / 100) * LOADING_PORTION);
		cloudProgress = STRATEGY_PORTION + Math.round((rawCloudProgress / 100) * LOADING_PORTION);
	}

	collabState.update((s) => ({
		...s,
		enabled: true,
		mode: 'edge_cloud',
		ribbonExpanded: task.status === 'completed' ? false : true,
		phase: inferUiPhase(task),
		overallProgress: clamp(task.overall_progress ?? 0, 0, 100),
		taskId: task.task_id,
		backendStatus: task.status,
		backendPhase: task.phase,
		message: task.message ?? '',
		error: task.error_detail ?? null,
		edge: {
			...s.edge,
			progress: edgeProgress,
			status: buildNodeStatus(
				task.phase,
				task.message,
				task.edge_status,
				task.edge_message,
				'边端加载中'
			)
		},
		cloud: {
			...s.cloud,
			progress: cloudProgress,
			status: buildNodeStatus(
				task.phase,
				task.message,
				task.cloud_status,
				task.cloud_message,
				'云端加载中'
			)
		},
		split: {
			...s.split,
			strategy:
				task.phase === 'strategy'
					? '正在计算策略'
					: task.status === 'completed'
						? '策略已生效'
						: '策略已生成'
		},
		network: {
			...s.network,
			status:
				task.status === 'completed'
					? 'connected'
					: task.status === 'failed'
						? 'disconnected'
						: 'connecting'
		}
	}));
};

export const applyStrategyToStore = (strategyData: TaskStrategyResponse) => {
	const summary = summarizeStrategyDecision(strategyData.decision);

	collabState.update((s) => ({
		...s,
		split: {
			...s.split,
			strategy: '策略已生成',
			totalLayers: summary.totalLayers,
			edgePercent: summary.edgePercent,
			cloudPercent: summary.cloudPercent,
			edgeHeadCountTotal: summary.edgeHeadCountTotal,
			cloudHeadCountTotal: summary.cloudHeadCountTotal,
			totalHeadCount: summary.totalHeadCount,
			modelType: strategyData.model_type,
			layerPartitions: summary.layerPartitions
		}
	}));
};

/* =========================
   Mock API
   ========================= */

const mockTaskStore = new Map<
	string,
	{
		startAt: number;
		failAt: MockFailStage;
		modelType: string;
	}
>();

const mockNowIso = () => new Date().toISOString();

const mockLoginToCloud = async () => {
	await wait(100);

	if (MOCK_FAIL_STAGE === 'login') {
		throw new Error('mock: token exchange 失败');
	}

	const token = 'mock-cloud-backend-token';

	setCloudToken(token);
	setRuntimeToken(token);

	return {
		access_token: token,
		token_type: 'bearer',
		username: 'mock-user',
		role: 'user'
	};
};

const mockTriggerScheduleTask = async (modelType: string): Promise<BackendTask> => {
	await wait(300);

	if (MOCK_FAIL_STAGE === 'trigger') {
		throw new Error('mock: 任务创建失败');
	}

	const taskId = `mock-task-${Date.now()}`;

	mockTaskStore.set(taskId, {
		startAt: Date.now(),
		failAt: MOCK_FAIL_STAGE,
		modelType
	});

	return {
		task_id: taskId,
		status: 'accepted',
		phase: 'strategy',
		phase_progress: 0,
		overall_progress: 0,
		message: '任务已受理，开始计算切分策略',
		edge_message: '边端正在加载模型权重',
		cloud_message: '云端正在初始化推理上下文',
		created_at: mockNowIso(),
		updated_at: mockNowIso()
	};
};

const mockGetTaskStatus = async (taskId: string): Promise<BackendTask> => {
	await wait(150);

	const task = mockTaskStore.get(taskId);

	if (!task) {
		throw new Error('mock: 任务不存在');
	}

	const elapsed = Date.now() - task.startAt;

	if (task.failAt === 'strategy' && elapsed >= 1800) {
		return {
			task_id: taskId,
			status: 'failed',
			phase: 'strategy',
			phase_progress: 58,
			overall_progress: 24,
			message: '切分策略计算失败',
			edge_message: '边端正在加载模型权重',
			cloud_message: '云端正在初始化推理上下文',
			error_detail: 'mock: strategy service unavailable',
			created_at: mockNowIso(),
			updated_at: mockNowIso()
		};
	}

	if (elapsed < 3000) {
		const phaseProgress = Math.min(100, Math.floor((elapsed / 3000) * 100));
		return {
			task_id: taskId,
			status: elapsed < 500 ? 'accepted' : 'running',
			phase: 'strategy',
			phase_progress: phaseProgress,
			overall_progress: Math.floor(phaseProgress * 0.4),
			message: phaseProgress < 100 ? '正在计算切分策略' : '策略已生成，等待加载',
			edge_message: '边端等待策略结果',
			cloud_message: '云端等待策略结果',
			error_detail: null,
			created_at: mockNowIso(),
			updated_at: mockNowIso()
		};
	}

	if (task.failAt === 'loading' && elapsed >= 5200) {
		return {
			task_id: taskId,
			status: 'failed',
			phase: 'loading',
			phase_progress: 44,
			overall_progress: 66,
			message: '边端模型加载失败',
			edge_progress: 45,
			cloud_progress: 35,
			edge_status: 'loading',
			cloud_status: 'loading',
			edge_message: '边端正在加载模型权重',
			cloud_message: '云端正在初始化推理上下文',
			error_detail: 'mock: edge runtime load failed',
			created_at: mockNowIso(),
			updated_at: mockNowIso()
		};
	}

	if (elapsed < 8000) {
		const loadingElapsed = elapsed - 3000;
		const phaseProgress = Math.min(100, Math.floor((loadingElapsed / 5000) * 100));
		const edgeProgress = Math.min(100, Math.floor((loadingElapsed / 4000) * 100));
		const cloudProgress = Math.min(100, Math.floor((loadingElapsed / 5000) * 100));

		return {
			task_id: taskId,
			status: 'running',
			phase: 'loading',
			phase_progress: phaseProgress,
			overall_progress: 40 + Math.floor(phaseProgress * 0.6),
			message: cloudProgress < 100 ? '边云模型加载中' : '等待通信握手完成',
			edge_progress: edgeProgress,
			cloud_progress: cloudProgress,
			edge_status: edgeProgress >= 100 ? 'ready' : edgeProgress > 0 ? 'loading' : 'dispatching',
			cloud_status: cloudProgress >= 100 ? 'ready' : cloudProgress > 0 ? 'loading' : 'dispatching',
			edge_message: edgeProgress >= 100 ? '边端就绪' : '边端正在加载模型权重',
			cloud_message: cloudProgress >= 100 ? '云端就绪' : '云端正在初始化推理上下文',
			error_detail: null,
			created_at: mockNowIso(),
			updated_at: mockNowIso()
		};
	}

	return {
		task_id: taskId,
		status: 'completed',
		phase: 'completed',
		phase_progress: 100,
		overall_progress: 100,
		message: '边云模型均已就绪',
		edge_progress: 100,
		cloud_progress: 100,
		edge_status: 'ready',
		cloud_status: 'ready',
		edge_message: '边端就绪',
		cloud_message: '云端就绪',
		error_detail: null,
		created_at: mockNowIso(),
		updated_at: mockNowIso()
	};
};

const mockGetTaskStrategy = async (taskId: string): Promise<TaskStrategyResponse> => {
	await wait(120);

	return {
		task_id: taskId,
		model_type: 'llama-3.2-3b',
		decision: {
			edge_head_count_total: 336,
			cloud_head_count_total: 1000,
			layer_partitions: Array.from({ length: 28 }, (_, layerId) => ({
				layer_id: layerId,
				head_assignments: Array.from({ length: 24 }, (_, i) => (i % 2 === 0 ? 0 : 1)),
				ffn_assignment: layerId % 2,
				edge_head_count: 12,
				cloud_head_count: 12
			}))
		}
	};
};

/* =========================
   Real API / unified exports
   ========================= */

export const loginToCloud = async () => {
	if (USE_MOCK_CLOUD_API) {
		return mockLoginToCloud();
	}

	const openwebuiToken = getOpenWebUIToken();

	if (!openwebuiToken) {
		throw new Error('OpenWebUI 尚未登录，无法进行 token exchange');
	}

	const res = await fetch(`${API_BASE}/auth/exchange`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			openwebui_token: openwebuiToken
		})
	});

	const data = await parseJsonSafely(res);

	if (!res.ok) {
		throw new Error(extractErrorMessage(data, 'token exchange 失败'));
	}

	const cloudToken = data?.access_token;

	if (!cloudToken) {
		throw new Error('token exchange 成功，但返回中没有 access_token');
	}

	setCloudToken(cloudToken);
	setRuntimeToken(cloudToken);

	return data;
};

export const triggerScheduleTask = async (modelType: string): Promise<BackendTask> => {
	if (USE_MOCK_CLOUD_API) {
		return mockTriggerScheduleTask(modelType);
	}

	const res = await fetch(`${API_BASE}/schedule/trigger`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			...getAuthorizedHeaders()
		},
		body: JSON.stringify({
			model_type: modelType
		})
	});

	const data = await parseJsonSafely(res);

	if (res.status === 401) {
		clearCloudToken();
		throw new Error('云端调度 token 已失效，请重新进行 token exchange');
	}

	if (!res.ok) {
		throw new Error(extractErrorMessage(data, '任务创建失败'));
	}

	return data as BackendTask;
};

export const getTaskStatus = async (taskId: string) => {
	if (USE_MOCK_CLOUD_API) {
		return mockGetTaskStatus(taskId);
	}

	const res = await fetch(`${API_BASE}/schedule/tasks/${taskId}`, {
		headers: {
			...getAuthorizedHeaders()
		}
	});

	const data = await parseJsonSafely(res);

	if (res.status === 401) {
		clearCloudToken();
		throw new Error('云端调度 token 已失效，请重新进行 token exchange');
	}

	if (!res.ok) {
		throw new Error(extractErrorMessage(data, '获取任务状态失败'));
	}

	return data as BackendTask;
};

export const getTaskStrategy = async (taskId: string): Promise<TaskStrategyResponse> => {
	if (USE_MOCK_CLOUD_API) {
		return mockGetTaskStrategy(taskId);
	}

	const res = await fetch(`${API_BASE}/schedule/tasks/${taskId}/strategy`, {
		headers: {
			...getAuthorizedHeaders()
		}
	});

	const data = await parseJsonSafely(res);

	if (res.status === 401) {
		clearCloudToken();
		throw new Error('云端调度 token 已失效，请重新进行 token exchange');
	}

	if (!res.ok) {
		throw new Error(extractErrorMessage(data, '获取切分策略失败'));
	}

	return data as TaskStrategyResponse;
};

const ensureTaskStrategyLoaded = (taskId: string) => {
	if (strategyLoadedTaskIds.has(taskId) || strategyLoadingTaskIds.has(taskId)) {
		return;
	}

	strategyLoadingTaskIds.add(taskId);

	void getTaskStrategy(taskId)
		.then((strategy) => {
			applyStrategyToStore(strategy);
			strategyLoadedTaskIds.add(taskId);
		})
		.catch((error) => {
			console.warn('获取切分策略失败:', error);
		})
		.finally(() => {
			strategyLoadingTaskIds.delete(taskId);
		});
};

// 轮询器：每隔 300ms 调用一次 getTaskStatus(taskId)
// 把得到的任务结果交给 applyTaskToStore，直到任务 completed 或 failed 停止
export const startTaskPolling = (taskId: string) => {
	if (!isBrowser) return;

	stopTaskPolling();

	const poll = async () => {
		try {
			const task = await getTaskStatus(taskId);

			// 先更新状态，这样边端/云端小进度条会持续动
			applyTaskToStore(task);

			// 任务结束就停止轮询
			if (task.status === 'completed' || task.status === 'failed') {
				stopTaskPolling();
				return;
			}

			// 先挂下一轮轮询，保证状态轮询不中断
			pollTimer = window.setTimeout(poll, 300);

			// 进入 loading 后，只触发一次 strategy 拉取
			if (task.phase === 'loading') {
				ensureTaskStrategyLoaded(task.task_id);
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : '轮询失败';
			collabState.update((s) => ({
				...s,
				enabled: true,
				phase: 'failed',
				error: message,
				network: {
					...s.network,
					status: 'disconnected'
				}
			}));
			stopTaskPolling();
		}
	};

	void poll();
};
// 流程入口，清理旧定时器和轮询，根据传入的 payload 计算层数等。
export const startRealCollabPreparation = async (
	modelType: string,
	payload?: {
		edgeModel?: string;
		cloudModel?: string;
		edgeDevice?: string;
		cloudDevice?: string;
		cutLayer?: number;
		totalLayers?: number;
		strategy?: string;
		edgePercent?: number;
		cloudPercent?: number;
		edgeStorageLimitGb?: number;
	}
) => {
	clearTimers();
	stopTaskPolling();
	strategyLoadedTaskIds.clear();
	strategyLoadingTaskIds.clear();

	const totalLayers = Math.max(payload?.totalLayers ?? 32, 1);
	const cutLayer = clamp(Math.round(payload?.cutLayer ?? 16), 0, totalLayers);
	const { edgePercent, cloudPercent } = normalizeSplitPercents({
		edgePercent: payload?.edgePercent,
		cloudPercent: payload?.cloudPercent,
		cutLayer,
		totalLayers
	});

	const task = await triggerScheduleTask(modelType);

	collabState.update((s) => ({
		...s,
		enabled: true,
		mode: 'edge_cloud',
		ribbonExpanded: true,
		phase: 'planning',
		overallProgress: 0,
		taskId: task.task_id,
		backendStatus: task.status,
		backendPhase: task.phase,
		message: task.message ?? '任务已受理，开始计算切分策略',
		error: null,
		edge: {
			...s.edge,
			name: payload?.edgeModel ?? s.edge.name,
			device: payload?.edgeDevice ?? s.edge.device,
			progress: 0,
			status: '等待切分策略',
			startLayer: 0,
			endLayer: Math.max(cutLayer - 1, 0)
		},
		cloud: {
			...s.cloud,
			name: payload?.cloudModel ?? s.cloud.name,
			device: payload?.cloudDevice ?? s.cloud.device,
			progress: 0,
			status: '等待切分策略',
			startLayer: cutLayer,
			endLayer: Math.max(totalLayers - 1, 0)
		},
		split: {
			cutLayer,
			strategy: payload?.strategy ?? '正在计算策略',
			totalLayers,
			edgePercent,
			cloudPercent,
			edgeRange: `L0-L${Math.max(cutLayer - 1, 0)}`,
			cloudRange: `L${cutLayer}-L${Math.max(totalLayers - 1, 0)}`,
			currentLayer: cutLayer,
			edgeHeadCountTotal: undefined,
			cloudHeadCountTotal: undefined,
			totalHeadCount: undefined,
			modelType: undefined,
			layerPartitions: []
		},
		network: {
			rttMs: 0,
			bandwidthMbps: 0,
			status: 'connecting'
		}
	}));

	applyTaskToStore(task);
	startTaskPolling(task.task_id);
	return task;
};

