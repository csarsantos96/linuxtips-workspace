<script lang="ts">
	import PomodoroTimer from '$lib/components/PomodoroTimer.svelte';
	import Empty from '$lib/components/Empty.svelte';
	import Button from '$lib/components/Button.svelte';
	import { focusApi, type StudySession } from '$lib/api/focus';
	import { formatDateTime, formatDurationSeconds } from '$lib/utils/format';
	import { Flame, History, Timer } from 'lucide-svelte';

	export let data;

	let sessions: StudySession[] = data.todaySessions;
	let active: StudySession | null = sessions.find((s) => s.status === 'active') ?? null;

	async function reload() {
		try {
			const res = await focusApi.today();
			sessions = res.items;
			active = sessions.find((s) => s.status === 'active') ?? null;
		} catch {
			// API offline — mantém estado atual.
		}
	}
</script>

<svelte:head><title>Focus — PICKStack</title></svelte:head>

<section class="grid gap-6 lg:grid-cols-3">
	<div class="space-y-4 lg:col-span-2">
		<PomodoroTimer
			bind:active
			on:started={reload}
			on:ended={reload}
			on:abandoned={reload}
		/>

		<div class="card">
			<header class="mb-3 flex items-center justify-between">
				<h2 class="text-sm font-semibold text-slate-100">Sessões de hoje</h2>
				<Button variant="ghost" size="sm" href="/focus/history">
					<History size={14} /> Histórico
				</Button>
			</header>

			{#if data.unavailable}
				<Empty
					variant="unavailable"
					title="focus-svc indisponível"
					description="Subir api-gateway + focus-svc para listar sessões."
				/>
			{:else if sessions.length === 0}
				<Empty
					icon={Timer}
					title="Nenhuma sessão hoje"
					description="Quando você iniciar uma sessão, ela aparecerá aqui."
				/>
			{:else}
				<ul class="divide-y divide-surface-border text-sm">
					{#each sessions as s}
						<li class="flex items-center justify-between py-3">
							<div>
								<div class="font-medium text-slate-100">{s.type}</div>
								<div class="text-xs text-muted">{formatDateTime(s.startedAt)}</div>
							</div>
							<div class="text-right">
								<div class="text-slate-100">
									{formatDurationSeconds(s.actualDurationS ?? s.plannedDurationS)}
								</div>
								<div
									class="text-xs"
									class:text-success={s.status === 'completed'}
									class:text-warning={s.status === 'active'}
									class:text-danger={s.status === 'abandoned'}
								>
									{s.status}
								</div>
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	</div>

	<aside class="card flex flex-col items-center gap-2 py-6">
		<Flame size={28} class="text-warning" />
		<div class="text-xs uppercase tracking-wide text-muted">Streak atual</div>
		<div class="text-4xl font-semibold text-slate-100">{data.streak?.current ?? 0}</div>
		<div class="text-xs text-muted">
			Recorde: <span class="text-slate-200">{data.streak?.longest ?? 0} dias</span>
		</div>
		{#if data.streak?.lastActiveDate}
			<div class="text-xs text-muted">Última atividade: {data.streak.lastActiveDate}</div>
		{/if}
	</aside>
</section>
