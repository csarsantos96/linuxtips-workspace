// Cliente do trilha-svc (roadmaps).
//
// Backend usa `name` (não `title`) e devolve o detalhe achatado (`{...rm, nodes}`).
// Aqui dividimos em `{ roadmap, nodes }` e renomeamos para `title` no domínio do
// frontend (alinhado com a UI). Também derivamos `nodeCount`/`doneCount` para
// os cards de listagem.

import { api } from './client';

export type NodeStatus = 'todo' | 'learning' | 'done';

export interface Roadmap {
	id: string;
	title: string;
	description?: string | null;
	isPublic: boolean;
	ownerId: string;
	nodeCount: number;
	doneCount: number;
	createdAt: string;
}

export interface RoadmapResource {
	kind: 'link' | 'video' | 'book' | 'doc';
	title: string;
	url?: string;
}

export interface RoadmapNode {
	id: string;
	roadmapId: string;
	parentId?: string | null;
	title: string;
	description?: string | null;
	resources: RoadmapResource[];
	order: number;
	status: NodeStatus;
}

// --- shapes do backend ------------------------------------------------------

interface RawRoadmap {
	id: string;
	name: string;
	description?: string | null;
	is_public?: boolean;
	isPublic?: boolean;
	owner_id?: string;
	ownerId?: string;
	tenant_id?: string;
	tenantId?: string;
	source_url?: string | null;
	sourceUrl?: string | null;
	created_at?: string;
	createdAt?: string;
}

interface RawNode {
	id: string;
	roadmap_id?: string;
	roadmapId?: string;
	external_id?: string;
	externalId?: string;
	title: string;
	description?: string | null;
	category?: string | null;
	depends_on?: string[] | null;
	dependsOn?: string[] | null;
	resources?: RoadmapResource[] | null;
	order_index?: number | null;
	orderIndex?: number | null;
	progress?: { status: NodeStatus } | null;
}

interface RawRoadmapDetail extends RawRoadmap {
	nodes: RawNode[];
}

function normalizeRoadmap(r: RawRoadmap, counts?: { node: number; done: number }): Roadmap {
	return {
		id: r.id,
		title: r.name,
		description: r.description ?? null,
		isPublic: !!(r.isPublic ?? r.is_public),
		ownerId: (r.ownerId ?? r.owner_id)!,
		nodeCount: counts?.node ?? 0,
		doneCount: counts?.done ?? 0,
		createdAt: (r.createdAt ?? r.created_at)!
	};
}

function normalizeNode(n: RawNode, ids: Map<string, string>): RoadmapNode {
	return {
		id: n.id,
		roadmapId: (n.roadmapId ?? n.roadmap_id)!,
		// `depends_on` é array de external_ids; usamos o primeiro como "parent"
		// para fins de visualização (a UI espera grafo árvore).
		parentId: ids.get((n.dependsOn ?? n.depends_on)?.[0] ?? '') ?? null,
		title: n.title,
		description: n.description ?? null,
		resources: n.resources ?? [],
		order: n.orderIndex ?? n.order_index ?? 0,
		status: n.progress?.status ?? 'todo'
	};
}

export const trilhaApi = {
	async list() {
		const raw = await api.get<RawRoadmap[]>('/api/trilha/roadmaps');
		const items = await Promise.all(raw.map(async (r) => (await trilhaApi.get(r.id)).roadmap));
		return { items };
	},

	async get(id: string) {
		const raw = await api.get<RawRoadmapDetail>(`/api/trilha/roadmaps/${id}`);
		const ids = new Map((raw.nodes ?? []).map((n) => [n.externalId ?? n.external_id ?? '', n.id]));
		const nodes = (raw.nodes ?? []).map((n) => normalizeNode(n, ids));
		const doneCount = nodes.filter((n) => n.status === 'done').length;
		return {
			roadmap: normalizeRoadmap(raw, { node: nodes.length, done: doneCount }),
			nodes
		};
	},

	async create(input: { title: string; description?: string; isPublic?: boolean }) {
		// Backend exige `name` + `nodes[>=1]`. Para "criar vazio" pela UI,
		// criamos um node-placeholder inicial que o usuário pode renomear depois.
		// (Alternativa seria flexibilizar o backend; decisão pedagógica: manter
		// a invariante "roadmap tem ao menos um nó" no domínio e adaptar no FE.)
		const raw = await api.post<RawRoadmap>('/api/trilha/roadmaps', {
			name: input.title,
			description: input.description,
			is_public: !!input.isPublic,
			nodes: [
				{
					external_id: 'start',
					title: 'Começar aqui',
					description: 'Edite este nó ou adicione outros.',
					order_index: 0
				}
			]
		});
		return normalizeRoadmap(raw, { node: 1, done: 0 });
	},

	async setNodeStatus(_roadmapId: string, nodeId: string, status: NodeStatus) {
		// Backend: `PATCH /nodes/:node_id/progress` (não POST nem aninhado em roadmap).
		const raw = await api.patch<{
			node_id: string;
			status: NodeStatus;
		}>(`/api/trilha/nodes/${nodeId}/progress`, { status });
		// A UI usa apenas `status` do retorno para confirmar; devolvemos um
		// shape mínimo de RoadmapNode (resto fica null/0 — o caller só lê status).
		return {
			id: nodeId,
			roadmapId: '',
			parentId: null,
			title: '',
			description: null,
			resources: [],
			order: 0,
			status: raw.status
		} as RoadmapNode;
	}
};
