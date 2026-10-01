<script lang="ts">
	import type { HeatmapDay } from '$lib/api/focus';
	import { formatDate, toIsoDate } from '$lib/utils/format';

	export let days: HeatmapDay[] = [];
	/** Total de dias a renderizar (default 90). */
	export let span = 90;

	$: byDate = new Map(days.map((d) => [d.date, d]));

	$: cells = (() => {
		const out: { date: string; count: number; totalSeconds: number }[] = [];
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		for (let i = span - 1; i >= 0; i--) {
			const d = new Date(today);
			d.setDate(today.getDate() - i);
			const iso = toIsoDate(d);
			const found = byDate.get(iso);
			out.push({ date: iso, count: found?.count ?? 0, totalSeconds: found?.totalSeconds ?? 0 });
		}
		return out;
	})();

	function intensity(count: number): string {
		if (count <= 0) return 'bg-surface';
		if (count < 2) return 'bg-success/30';
		if (count < 4) return 'bg-success/50';
		if (count < 6) return 'bg-success/70';
		return 'bg-success';
	}
</script>

<div class="card">
	<header class="mb-3 flex items-center justify-between">
		<h3 class="text-sm font-semibold text-slate-100">Atividade — últimos {span} dias</h3>
		<div class="flex items-center gap-1 text-[10px] text-muted">
			<span>menos</span>
			<span class="h-3 w-3 rounded-sm bg-surface" />
			<span class="h-3 w-3 rounded-sm bg-success/30" />
			<span class="h-3 w-3 rounded-sm bg-success/50" />
			<span class="h-3 w-3 rounded-sm bg-success/70" />
			<span class="h-3 w-3 rounded-sm bg-success" />
			<span>mais</span>
		</div>
	</header>
	<div
		class="grid grid-flow-col grid-rows-7 gap-1"
		style="grid-auto-columns: 12px;"
	>
		{#each cells as cell (cell.date)}
			<div
				class="h-3 w-3 rounded-sm {intensity(cell.count)} transition-transform hover:scale-125"
				title="{formatDate(cell.date)} — {cell.count} sess{cell.count === 1 ? 'ão' : 'ões'}"
			></div>
		{/each}
	</div>
</div>
