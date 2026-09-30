import { focusApi } from '$lib/api/focus';
import type { StreakInfo, StudySession } from '$lib/api/focus';

async function safe<T>(p: Promise<T>): Promise<T | null> {
	try {
		return await p;
	} catch {
		return null;
	}
}

export const load = async () => {
	const [today, streak] = await Promise.all([safe(focusApi.today()), safe(focusApi.streak())]);

	return {
		todaySessions: (today?.items ?? []) as StudySession[],
		streak: (streak ?? null) as StreakInfo | null,
		unavailable: today === null && streak === null
	};
};
