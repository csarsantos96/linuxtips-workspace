<script lang="ts">
	import StatCard from '$lib/components/StatCard.svelte';
	import Heatmap from '$lib/components/Heatmap.svelte';
	import Empty from '$lib/components/Empty.svelte';
	import { Flame, Timer, Layers, Map, Sparkles } from 'lucide-svelte';
	import { formatDateTime, formatDurationSeconds } from '$lib/utils/format';
	import { auth } from '$lib/stores/auth';

	export let data;

	$: sessionsToday = data.todaySessions.length;
	$: lastActions = data.todaySessions.slice(0, 3);
</script>

<svelte:head><title>Dashboard — PICKStack</title></svelte:head>

<section class="space-y-6">
	<header class="flex items-end justify-between">
		<div>
			<h1 class="text-2xl font-semibold text-slate-100">
				Olá, {$auth.user?.name ?? 'estudante'} 👋
			</h1>
			<p class="text-sm text-muted">Aqui está o resumo do seu dia.</p>
		</div>
	</header>

	{#if data.unavailable}
		<Empty
			variant="unavailable"
			icon={Sparkles}
			title="Estatísticas indisponíveis"
			description="O api-gateway parece estar offline. Suba os serviços com `docker compose up -d` e recarregue."
		/>
	{:else}
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
			<StatCard label="Sessões hoje" value={sessionsToday} icon={Timer} />
			<StatCard
				label="Streak atual"
				value="{data.streak?.current ?? 0} dias"
				hint="Recorde: {data.streak?.longest ?? 0}"
				icon={Flame}
			/>
			<StatCard label="Cards revisados hoje" value={data.extras.reviewedToday} icon={Layers} />
			<StatCard
				label="% roadmap atual"
				value="{data.extras.pctRoadmap}%"
				icon={Map}
			/>
		</div>

		<Heatmap days={data.heatmap} span={90} />

		<section class="card">
			<header class="mb-3 flex items-center justify-between">
				<h3 class="text-sm font-semibold text-slate-100">Continuar de onde parou</h3>
			</header>

			{#if lastActions.length === 0}
				<Empty
					title="Nenhuma atividade hoje"
					description="Comece uma sessão de foco para aparecer aqui."
				/>
			{:else}
				<ul class="divide-y divide-surface-border">
					{#each lastActions as s}
						<li class="flex items-center justify-between py-3 text-sm">
							<div>
								<div class="font-medium text-slate-100">{s.type}</div>
								<div class="text-xs text-muted">{formatDateTime(s.startedAt)}</div>
							</div>
							<div class="text-xs text-muted">
								{formatDurationSeconds(s.actualDurationS ?? s.plannedDurationS)} · {s.status}
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	{/if}
</section>
