import { get, writable } from 'svelte/store';

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

export interface CloudDeviceInfo {
	id: string;
	name: string;
	type: string;
	ip: string;
}

export interface SessionInitResponse {
	session_id: string;
	openwebui_user_id?: string;
	openwebui_username?: string;
	openwebui_role?: string;
	edge_device?: CloudDeviceInfo;
	cloud_device?: CloudDeviceInfo;
	message?: string;
}

export interface CollabNodeState {
	name: string;
	device: string;
	progress: number;
	status: string;
	startLayer: number;
	endLayer: number;
}

export interface CollabState {
	enabled: boolean;
	mode: 'single' | 'edge_cloud';
	ribbonExpanded: boolean;
	ribbonManuallyCollapsed: boolean;
	phase: CollabPhase;
	overallProgress: number;

	token: string | null;
	sessionId: string | null;
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

type MockFailStage = 'none' | 'login' | 'session_init' | 'trigger' | 'strategy' | 'loading';

const isBrowser = typeof window !== 'undefined';

const isIpv4 = (value: string) => {
	return /^(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)){3}$/.test(
		value
	);
};

const getRuntimeHostname = () => {
	if (!isBrowser) return null;
	return window.location.hostname?.trim() || null;
};

const resolveEdgeDeviceIp = () => {
	const runtimeHost = getRuntimeHostname();
	if (runtimeHost && isIpv4(runtimeHost) && runtimeHost !== '127.0.0.1') {
		return runtimeHost;
	}
	return '';
};

const resolveApiBase = () => {
	const envBase = (import.meta.env.VITE_CLOUD_API_BASE ?? '').trim();
	if (envBase) {
		const normalized = envBase.replace(/\/+$/, '');
		return normalized.endsWith('/api/v1') ? normalized : `${normalized}/api/v1`;
	}

	if (!isBrowser) {
		return 'http://127.0.0.1:8010/api/v1';
	}

	const { protocol, hostname } = window.location;
	const base = `${protocol}//${hostname}:8010`;
	return base.endsWith('/api/v1') ? base : `${base}/api/v1`;
};

const API_BASE = resolveApiBase();

const USE_MOCK_CLOUD_API = (import.meta.env.VITE_USE_MOCK_CLOUD_API ?? 'true') === 'true';
const MOCK_FAIL_STAGE = (import.meta.env.VITE_MOCK_CLOUD_FAIL_STAGE ?? 'none') as MockFailStage;

// console.log('USE_MOCK_CLOUD_API:', USE_MOCK_CLOUD_API);

const OPENWEBUI_TOKEN_KEYS = ['token', 'openwebui_token'];
const SESSION_ID_KEY = 'edge_session_id';

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

const normalizeStoredToken = (raw: string | null) => {
	if (!raw) return null;

	try {
		const parsed = JSON.parse(raw);

		if (typeof parsed === 'string') return parsed;
		if (parsed && typeof parsed === 'object') {
			return parsed.token ?? parsed.access_token ?? raw;
		}
	} catch {
		// ignore
	}

	return raw;
};

const getOpenWebUIToken = () => {
	if (!isBrowser) return null;

	for (const key of OPENWEBUI_TOKEN_KEYS) {
		const token = normalizeStoredToken(window.localStorage.getItem(key));
		if (token) return token;
	}

	return null;
};

const getSessionId = () => {
	if (!isBrowser) return null;
	return window.localStorage.getItem(SESSION_ID_KEY) ?? null;
};

const setRuntimeToken = (token: string | null) => {
	collabState.update((s) => ({
		...s,
		token
	}));
};

const setRuntimeSessionId = (sessionId: string | null) => {
	collabState.update((s) => ({
		...s,
		sessionId
	}));
};

const setSessionId = (sessionId: string | null) => {
	if (!isBrowser) return;

	if (sessionId) {
		window.localStorage.setItem(SESSION_ID_KEY, sessionId);
	} else {
		window.localStorage.removeItem(SESSION_ID_KEY);
	}

	setRuntimeSessionId(sessionId);
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
	ribbonManuallyCollapsed: false,
	phase: 'idle',
	overallProgress: 0,

	token: getOpenWebUIToken(),
	sessionId: getSessionId(),
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

let pollTimer: number | null = null;
const TASK_POLL_INTERVAL_MS = 1000;
const PROGRESS_ANIMATION_INTERVAL_MS = 80;
const STRATEGY_PORTION = 50;
const LOADING_PORTION = 100 - STRATEGY_PORTION;
const strategyLoadedTaskIds = new Set<string>();
const strategyLoadingTaskIds = new Set<string>();
let activePreparationModelType: string | null = null;
let activePreparationPromise: Promise<BackendTask> | null = null;
let progressAnimationTimer: number | null = null;
let progressTargets = {
	overall: 0,
	edge: 0,
	cloud: 0
};

const clearProgressAnimation = () => {
	if (!isBrowser || progressAnimationTimer === null) return;

	window.clearInterval(progressAnimationTimer);
	progressAnimationTimer = null;
};

const stepProgressToward = (current: number, target: number) => {
	const safeCurrent = clamp(Math.round(current ?? 0), 0, 100);
	const safeTarget = clamp(Math.round(target ?? 0), 0, 100);

	if (safeCurrent === safeTarget) return safeCurrent;
	if (safeTarget < safeCurrent) return safeTarget;

	const distance = safeTarget - safeCurrent;
	const step = clamp(Math.ceil(distance / 10), 1, 4);

	return Math.min(safeCurrent + step, safeTarget);
};

const animateProgressTo = (
	targets: { overall: number; edge: number; cloud: number },
	immediate = false
) => {
	progressTargets = {
		overall: clamp(Math.round(targets.overall), 0, 100),
		edge: clamp(Math.round(targets.edge), 0, 100),
		cloud: clamp(Math.round(targets.cloud), 0, 100)
	};

	if (immediate || !isBrowser) {
		clearProgressAnimation();
		collabState.update((s) => ({
			...s,
			overallProgress: progressTargets.overall,
			edge: {
				...s.edge,
				progress: progressTargets.edge
			},
			cloud: {
				...s.cloud,
				progress: progressTargets.cloud
			}
		}));
		return;
	}

	if (progressAnimationTimer !== null) {
		return;
	}

	progressAnimationTimer = window.setInterval(() => {
		let done = false;

		collabState.update((s) => {
			const nextOverall = stepProgressToward(s.overallProgress, progressTargets.overall);
			const nextEdge = stepProgressToward(s.edge.progress, progressTargets.edge);
			const nextCloud = stepProgressToward(s.cloud.progress, progressTargets.cloud);

			done =
				nextOverall === progressTargets.overall &&
				nextEdge === progressTargets.edge &&
				nextCloud === progressTargets.cloud;

			return {
				...s,
				overallProgress: nextOverall,
				edge: {
					...s.edge,
					progress: nextEdge
				},
				cloud: {
					...s.cloud,
					progress: nextCloud
				}
			};
		});

		if (done) {
			clearProgressAnimation();
		}
	}, PROGRESS_ANIMATION_INTERVAL_MS);
};

export const stopTaskPolling = () => {
	if (!isBrowser || pollTimer === null) return;
	window.clearTimeout(pollTimer);
	pollTimer = null;
};

export const resetCollabState = () => {
	stopTaskPolling();
	clearProgressAnimation();
	strategyLoadedTaskIds.clear();
	strategyLoadingTaskIds.clear();
	activePreparationModelType = null;
	activePreparationPromise = null;
	collabState.set({
		...initialState,
		token: getOpenWebUIToken(),
		sessionId: getSessionId()
	});
};

export const setCollabRibbonExpanded = (expanded: boolean) => {
	collabState.update((s) => ({
		...s,
		ribbonExpanded: expanded,
		ribbonManuallyCollapsed: !expanded
	}));
};

export const toggleCollabRibbon = () => {
	collabState.update((s) => {
		const expanded = !s.ribbonExpanded;

		return {
			...s,
			ribbonExpanded: expanded,
			ribbonManuallyCollapsed: !expanded
		};
	});
};

export const clearSession = () => {
	setSessionId(null);
};

export const hasStoredSession = () => {
	return Boolean(getSessionId());
};

export const clearCloudToken = () => {
	clearSession();
};

export const hasStoredCloudToken = () => {
	return hasStoredSession();
};

const getAuthorizedHeaders = (options?: { includeSessionId?: boolean }) => {
	const token = getOpenWebUIToken();

	if (!token) {
		throw new Error('OpenWebUI 尚未登录，无法调用云端调度接口');
	}

	const headers: Record<string, string> = {
		Authorization: `Bearer ${token}`
	};

	if (options?.includeSessionId) {
		const sessionId = getSessionId();

		if (!sessionId) {
			throw new Error('session_id 不存在，请先调用 /api/v1/session/init');
		}

		headers['Session-Id'] = sessionId;
	}

	return headers;
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
	const phaseProgress = clamp(task.phase_progress ?? 0, 0, 100);
	const rawEdgeProgress = clamp(task.edge_progress ?? 0, 0, 100);
	const rawCloudProgress = clamp(task.cloud_progress ?? 0, 0, 100);
	const edgeLoadProgress = task.edge_progress !== undefined ? rawEdgeProgress : phaseProgress;
	const cloudLoadProgress = task.cloud_progress !== undefined ? rawCloudProgress : phaseProgress;

	let edgeProgress = 0;
	let cloudProgress = 0;
	const overallProgress = clamp(task.overall_progress ?? 0, 0, 100);

	if (task.status === 'completed') {
		edgeProgress = 100;
		cloudProgress = 100;
	} else if (task.phase === 'strategy') {
		const strategyMapped = Math.round((phaseProgress / 100) * STRATEGY_PORTION);
		edgeProgress = strategyMapped;
		cloudProgress = strategyMapped;
	} else if (task.phase === 'loading') {
		edgeProgress = STRATEGY_PORTION + Math.round((edgeLoadProgress / 100) * LOADING_PORTION);
		cloudProgress = STRATEGY_PORTION + Math.round((cloudLoadProgress / 100) * LOADING_PORTION);
	}

	collabState.update((s) => ({
		...s,
		enabled: true,
		mode: 'edge_cloud',
		ribbonExpanded: task.status === 'completed' ? false : !s.ribbonManuallyCollapsed,
		ribbonManuallyCollapsed: task.status === 'completed' ? false : s.ribbonManuallyCollapsed,
		phase: inferUiPhase(task),
		overallProgress,
		token: getOpenWebUIToken(),
		taskId: task.task_id,
		backendStatus: task.status,
		backendPhase: task.phase,
		message: task.message ?? '',
		error: task.error_detail ?? null,
		edge: {
			...s.edge,
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

	animateProgressTo(
		{
			overall: get(collabState).overallProgress,
			edge: edgeProgress,
			cloud: cloudProgress
		},
		task.status === 'completed' || task.status === 'failed'
	);
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

const mockTaskStore = new Map<
	string,
	{
		startAt: number;
		failAt: MockFailStage;
		modelType: string;
		sessionId: string;
	}
>();

const mockNowIso = () => new Date().toISOString();

const mockInitSession = async (): Promise<SessionInitResponse> => {
	await wait(100);

	if (MOCK_FAIL_STAGE === 'login' || MOCK_FAIL_STAGE === 'session_init') {
		throw new Error('mock: session 初始化失败');
	}

	const sessionId = `mock-session-${Date.now()}`;
	const edgeDeviceIp = resolveEdgeDeviceIp();

	setRuntimeToken(getOpenWebUIToken());
	setSessionId(sessionId);

	return {
		session_id: sessionId,
		openwebui_user_id: 'mock-user-id',
		openwebui_username: 'mock-user',
		openwebui_role: 'user',
		edge_device: {
			id: 'edge_A',
			name: '边端 A',
			type: 'edge',
			ip: edgeDeviceIp
		},
		cloud_device: {
			id: 'cloud',
			name: '云端主机',
			type: 'cloud',
			ip: '10.144.144.2'
		},
		message: 'mock: session 初始化成功'
	};
};

const mockTriggerScheduleTask = async (modelType: string): Promise<BackendTask> => {
	await wait(300);

	if (MOCK_FAIL_STAGE === 'trigger') {
		throw new Error('mock: 任务创建失败');
	}

	const sessionId = getSessionId();
	if (!sessionId) {
		throw new Error('mock: session_id 不存在，请先初始化会话');
	}

	const taskId = `mock-task-${Date.now()}`;

	mockTaskStore.set(taskId, {
		startAt: Date.now(),
		failAt: MOCK_FAIL_STAGE,
		modelType,
		sessionId
	});

	return {
		task_id: taskId,
		status: 'accepted',
		phase: 'strategy',
		phase_progress: 0,
		overall_progress: 0,
		message: '任务已受理，开始计算切分策略',
		edge_message: '边端等待策略结果',
		cloud_message: '云端等待策略结果',
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
			edge_message: '边端等待策略结果',
			cloud_message: '云端等待策略结果',
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

export const initSession = async (): Promise<SessionInitResponse> => {
	if (USE_MOCK_CLOUD_API) {
		return mockInitSession();
	}

	const openwebuiToken = getOpenWebUIToken();

	if (!openwebuiToken) {
		throw new Error('OpenWebUI 尚未登录，无法初始化边端会话');
	}

	const edgeDeviceIp = resolveEdgeDeviceIp();

	const res = await fetch(`${API_BASE}/session/init`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${openwebuiToken}`
		},
		body: JSON.stringify({
			edge_device_ip: edgeDeviceIp
		})
	});

	const data = await parseJsonSafely(res);

	if (!res.ok) {
		throw new Error(extractErrorMessage(data, 'session 初始化失败'));
	}

	const sessionId = data?.session_id;
	if (!sessionId) {
		throw new Error('session 初始化成功，但返回中没有 session_id');
	}

	setRuntimeToken(openwebuiToken);
	setSessionId(sessionId);

	return data as SessionInitResponse;
};

export const triggerScheduleTask = async (modelType: string): Promise<BackendTask> => {
	if (USE_MOCK_CLOUD_API) {
		return mockTriggerScheduleTask(modelType);
	}

	const res = await fetch(`${API_BASE}/schedule/trigger`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			...getAuthorizedHeaders({ includeSessionId: true })
		},
		body: JSON.stringify({
			model_type: modelType
		})
	});

	const data = await parseJsonSafely(res);

	if (res.status === 401) {
		clearSession();
		throw new Error('OpenWebUI token 无效、过期，或 Session-Id 与当前 token 不匹配');
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
		throw new Error('OpenWebUI token 无效或已过期，请重新登录 OpenWebUI');
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
		throw new Error('OpenWebUI token 无效或已过期，请重新登录 OpenWebUI');
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

export const startTaskPolling = (taskId: string) => {
	if (!isBrowser) return;

	stopTaskPolling();

	const poll = async () => {
		try {
			const task = await getTaskStatus(taskId);

			applyTaskToStore(task);

			if (task.status === 'completed' || task.status === 'failed') {
				stopTaskPolling();
				return;
			}

			pollTimer = window.setTimeout(poll, TASK_POLL_INTERVAL_MS);

			if (task.phase === 'loading' || task.phase === 'completed') {
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

const createTaskFromState = (state: CollabState): BackendTask | null => {
	if (!state.taskId || state.backendStatus === 'idle' || state.backendPhase === 'idle') {
		return null;
	}

	return {
		task_id: state.taskId,
		status: state.backendStatus,
		phase: state.backendPhase,
		phase_progress: state.overallProgress,
		overall_progress: state.overallProgress,
		message: state.message,
		edge_progress: state.edge.progress,
		cloud_progress: state.cloud.progress,
		edge_status: state.edge.status,
		cloud_status: state.cloud.status,
		error_detail: state.error
	};
};

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
	const currentState = get(collabState);
	const existingTask = createTaskFromState(currentState);

	if (
		existingTask &&
		currentState.enabled &&
		currentState.backendStatus !== 'failed' &&
		currentState.split?.modelType === modelType
	) {
		if (
			currentState.backendStatus !== 'completed' &&
			pollTimer === null &&
			currentState.taskId
		) {
			startTaskPolling(currentState.taskId);
		}

		return existingTask;
	}

	if (activePreparationModelType === modelType && activePreparationPromise) {
		return activePreparationPromise;
	}

	activePreparationModelType = modelType;
	activePreparationPromise = (async () => {
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

	const session = await initSession();
	const task = await triggerScheduleTask(modelType);

	collabState.update((s) => ({
		...s,
		enabled: true,
		mode: 'edge_cloud',
		ribbonExpanded: true,
		ribbonManuallyCollapsed: false,
		phase: 'planning',
		overallProgress: 0,
		token: getOpenWebUIToken(),
		sessionId: session.session_id,
		taskId: task.task_id,
		backendStatus: task.status,
		backendPhase: task.phase,
		message: task.message ?? session.message ?? '任务已受理，开始计算切分策略',
		error: null,
		edge: {
			...s.edge,
			name: payload?.edgeModel ?? s.edge.name,
			device: payload?.edgeDevice ?? session.edge_device?.name ?? s.edge.device,
			progress: 0,
			status: '等待切分策略',
			startLayer: 0,
			endLayer: Math.max(cutLayer - 1, 0)
		},
		cloud: {
			...s.cloud,
			name: payload?.cloudModel ?? s.cloud.name,
			device: payload?.cloudDevice ?? session.cloud_device?.name ?? s.cloud.device,
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
			modelType,
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
	})();

	try {
		return await activePreparationPromise;
	} finally {
		activePreparationPromise = null;
	}
};
