import { trilhaApi } from '$lib/api/trilha';
import type { Roadmap } from '$lib/api/trilha';

async function safe<T>(p: Promise<T>): Promise<T | null> {
	try {
		return await p;
	} catch {
		return null;
	}
}

export const load = async () => {
	const res = await safe(trilhaApi.list());
	return {
		roadmaps: (res?.items ?? []) as Roadmap[],
		unavailable: res === null
	};
};
