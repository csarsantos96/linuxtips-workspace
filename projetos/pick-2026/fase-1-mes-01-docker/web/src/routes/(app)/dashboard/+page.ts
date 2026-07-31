// Dashboard: componho 3 stats em paralelo no frontend em vez de criar um
// agregador `/api/stats/dashboard` no api-gateway. Decisão pedagógica:
// orquestrar microsserviços do lado do cliente deixa explícito que cada widget
// vem de um serviço diferente (focus/cards/trilha) e mantém o gateway burro
// (só roteamento + JWT). Se a latência virar problema, criamos o agregador
// depois — mas pra um SaaS modular como este, 3 fetches paralelos sobre HTTP/1.1
// keep-alive já são bem rápidos.

import { focusApi } from '$lib/api/focus';
import type { HeatmapDay, StreakInfo, StudySession } from '$lib/api/focus';

async function safe<T>(p: Promise<T>): Promise<T | null> {
	try {
		return await p;
	} catch {
		return null;
	}
}

export const load = async () => {
	// Nota: os clients do api/ usam o `fetch` global via store auth; em SSR
	// SvelteKit já injeta um `fetch` que herda cookies. O cliente atual não
	// repassa `fetchFn` para todas as chamadas — em prod considere parametrizar.
	const [heatmap, streak, today] = await Promise.all([
		safe(focusApi.heatmap(90)),
		safe(focusApi.streak()),
		safe(focusApi.today())
	]);

	return {
		heatmap: (heatmap?.days ?? []) as HeatmapDay[],
		streak: (streak ?? null) as StreakInfo | null,
		todaySessions: (today?.items ?? []) as StudySession[],
		// Placeholder até termos endpoints de stats agregadas em cards/trilha.
		// Mantemos a UI funcionando com zeros para não quebrar a composição.
		extras: { reviewedToday: 0, pctRoadmap: 0 },
		unavailable: heatmap === null && streak === null && today === null
	};
};
