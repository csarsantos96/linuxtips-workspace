import { trilhaApi } from '$lib/api/trilha';
import type { Roadmap, RoadmapNode } from '$lib/api/trilha';

async function safe<T>(p: Promise<T>): Promise<T | null> {
	try {
		return await p;
	} catch {
		return null;
	}
}

export const load = async ({ params }) => {
	const res = await safe(trilhaApi.get(params.id));

	return {
		roadmapId: params.id,
		roadmap: (res?.roadmap ?? null) as Roadmap | null,
		nodes: (res?.nodes ?? []) as RoadmapNode[],
		unavailable: res === null
	};
};
