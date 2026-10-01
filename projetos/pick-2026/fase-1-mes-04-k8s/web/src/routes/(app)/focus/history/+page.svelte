<script lang="ts">
	import Heatmap from '$lib/components/Heatmap.svelte';
	import Empty from '$lib/components/Empty.svelte';
	import Button from '$lib/components/Button.svelte';
	import { formatDateTime, formatDurationSeconds } from '$lib/utils/format';
	import { History } from 'lucide-svelte';

	export let data;

	$: prevOffset = Math.max(0, data.offset - data.limit);
	$: nextOffset = data.offset + data.limit;
	$: hasPrev = data.offset > 0;
	$: hasNext = nextOffset < data.total;
</script>

<svelte:head><title>Histórico — PICKStack</title></svelte:head>

<section class="space-y-6">
	<header>
		<h1 class="text-2xl font-semibold text-slate-100">Histórico de foco</h1>
		<p class="text-sm text-muted">Todas as suas sessões e o heatmap dos últimos 180 dias.</p>
	</header>

	{#if data.unavailable}
		<Empty
			variant="unavailable"
			title="focus-svc indisponível"
			description="Não foi possível carregar o histórico."
		/>
	{:else}
		<Heatmap days={data.heatmap} span={180} />

		<div class="card">
			<header class="mb-3 flex items-center justify-between">
				<h2 class="text-sm font-semibold text-slate-100">
					Sessões ({data.total})
				</h2>
			</header>

			{#if data.items.length === 0}
				<Empty icon={History} title="Nada por aqui ainda" />
			{:else}
				<div class="overflow-x-auto">
					<table class="w-full text-sm">
						<thead class="text-xs uppercase text-muted">
							<tr class="border-b border-surface-border">
								<th class="py-2 text-left">Início</th>
								<th class="py-2 text-left">Tipo</th>
								<th class="py-2 text-right">Duração</th>
								<th class="py-2 text-right">Status</th>
							</tr>
						</thead>
						<tbody>
							{#each data.items as s}
								<tr class="border-b border-surface-border/60">
									<td class="py-2 text-slate-200">{formatDateTime(s.startedAt)}</td>
									<td class="py-2 text-slate-300">{s.type}</td>
									<td class="py-2 text-right text-slate-200">
										{formatDurationSeconds(s.actualDurationS ?? s.plannedDurationS)}
									</td>
									<td class="py-2 text-right">
										<span
											class:text-success={s.status === 'completed'}
											class:text-warning={s.status === 'active'}
											class:text-danger={s.status === 'abandoned'}
										>
											{s.status}
										</span>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				<footer class="mt-4 flex items-center justify-between text-xs text-muted">
					<span>
						{data.offset + 1}–{Math.min(data.offset + data.limit, data.total)} de {data.total}
					</span>
					<div class="flex gap-2">
						<Button variant="ghost" size="sm" disabled={!hasPrev} href={`?offset=${prevOffset}`}>
							Anterior
						</Button>
						<Button variant="ghost" size="sm" disabled={!hasNext} href={`?offset=${nextOffset}`}>
							Próximo
						</Button>
					</div>
				</footer>
			{/if}
		</div>
	{/if}
</section>
