import { focusApi } from '$lib/api/focus';
import type { HeatmapDay, StudySession } from '$lib/api/focus';

async function safe<T>(p: Promise<T>): Promise<T | null> {
	try {
		return await p;
	} catch {
		return null;
	}
}

export const load = async ({ url }) => {
	const offset = Number(url.searchParams.get('offset') ?? 0);
	const limit = 20;

	const [list, heatmap] = await Promise.all([
		safe(focusApi.list({ limit, offset })),
		safe(focusApi.heatmap(180))
	]);

	return {
		items: (list?.items ?? []) as StudySession[],
		total: list?.total ?? 0,
		heatmap: (heatmap?.days ?? []) as HeatmapDay[],
		limit,
		offset,
		unavailable: list === null && heatmap === null
	};
};
