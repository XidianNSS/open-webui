import { writable } from 'svelte/store';

export type CollabPhase =
	| 'idle'
	| 'planning'
	| 'edge_loading'
	| 'cloud_loading'
	| 'handshaking'
	| 'ready'
	| 'failed';

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
	phase: CollabPhase;
	overallProgress: number;

	edge: CollabNodeState;
	cloud: CollabNodeState;

	split: {
		cutLayer: number;
		strategy: string;
		totalLayers: number;
	};

	network: {
		rttMs: number;
		bandwidthMbps: number;
		status: 'disconnected' | 'connecting' | 'connected';
	};

	error: string | null;
}

const initialState: CollabState = {
	enabled: false,
	mode: 'single',
	ribbonExpanded: false,
	phase: 'idle',
	overallProgress: 0,
	edge: {
		name: 'Qwen-7B',
		device: 'Edge-A',
		progress: 0,
		status: '',
		startLayer: 0,
		endLayer: 15
	},
	cloud: {
		name: 'DeepSeek-R1',
		device: 'Cloud-B',
		progress: 0,
		status: '',
		startLayer: 16,
		endLayer: 31
	},
	split: {
		cutLayer: 16,
		strategy: '低时延优先',
		totalLayers: 32
	},
	network: {
		rttMs: 0,
		bandwidthMbps: 0,
		status: 'disconnected'
	},
	error: null
};

export const collabState = writable<CollabState>({ ...initialState });

let timers: number[] = [];

const clearTimers = () => {
	timers.forEach((id) => window.clearTimeout(id));
	timers = [];
};

export const resetCollabState = () => {
	clearTimers();
	collabState.set({ ...initialState });
};

export const setCollabRibbonExpanded = (expanded: boolean) => {
	collabState.update((s) => ({ ...s, ribbonExpanded: expanded }));
};

export const toggleCollabRibbon = () => {
	collabState.update((s) => ({ ...s, ribbonExpanded: !s.ribbonExpanded }));
};

export const startMockCollabPreparation = (payload?: {
	edgeModel?: string;
	cloudModel?: string;
	edgeDevice?: string;
	cloudDevice?: string;
	cutLayer?: number;
	totalLayers?: number;
	strategy?: string;
}) => {
	clearTimers();

	const totalLayers = payload?.totalLayers ?? 32;
	const cutLayer = payload?.cutLayer ?? 16;

	collabState.set({
		enabled: true,
		mode: 'edge_cloud',
		ribbonExpanded: true,
		phase: 'planning',
		overallProgress: 8,
		edge: {
			name: payload?.edgeModel ?? 'Qwen-7B',
			device: payload?.edgeDevice ?? 'Edge-A',
			progress: 0,
			status: '等待切分策略',
			startLayer: 0,
			endLayer: cutLayer - 1
		},
		cloud: {
			name: payload?.cloudModel ?? 'DeepSeek-R1',
			device: payload?.cloudDevice ?? 'Cloud-B',
			progress: 0,
			status: '等待切分策略',
			startLayer: cutLayer,
			endLayer: totalLayers - 1
		},
		split: {
			cutLayer,
			strategy: payload?.strategy ?? '低时延优先',
			totalLayers
		},
		network: {
			rttMs: 0,
			bandwidthMbps: 0,
			status: 'connecting'
		},
		error: null
	});

	timers.push(
		window.setTimeout(() => {
			collabState.update((s) => ({
				...s,
				phase: 'planning',
				overallProgress: 18,
				edge: { ...s.edge, status: '已生成切分策略，等待边端加载' },
				cloud: { ...s.cloud, status: '已生成切分策略，等待云端加载' }
			}));
		}, 500)
	);

	timers.push(
		window.setTimeout(() => {
			collabState.update((s) => ({
				...s,
				phase: 'edge_loading',
				overallProgress: 36,
				edge: { ...s.edge, progress: 46, status: '正在加载边端权重' },
				cloud: { ...s.cloud, progress: 8, status: '等待云端加载' }
			}));
		}, 1200)
	);

	timers.push(
		window.setTimeout(() => {
			collabState.update((s) => ({
				...s,
				phase: 'cloud_loading',
				overallProgress: 63,
				edge: { ...s.edge, progress: 72, status: '正在初始化 KV Cache' },
				cloud: { ...s.cloud, progress: 41, status: '正在加载切分层' }
			}));
		}, 2200)
	);

	timers.push(
		window.setTimeout(() => {
			collabState.update((s) => ({
				...s,
				phase: 'handshaking',
				overallProgress: 86,
				edge: { ...s.edge, progress: 100, status: '边端已就绪' },
				cloud: { ...s.cloud, progress: 88, status: '等待通信握手完成' },
				network: {
					rttMs: 28,
					bandwidthMbps: 84,
					status: 'connected'
				}
			}));
		}, 3400)
	);

	timers.push(
		window.setTimeout(() => {
			collabState.update((s) => ({
				...s,
				phase: 'ready',
				overallProgress: 100,
				ribbonExpanded: false,
				edge: { ...s.edge, progress: 100, status: '边端已就绪' },
				cloud: { ...s.cloud, progress: 100, status: '云端已就绪' }
			}));
		}, 4700)
	);
};
