<script lang="ts">
	import { createEventDispatcher, onDestroy } from 'svelte';
	import { Play, Square, XCircle } from 'lucide-svelte';
	import Button from './Button.svelte';
	import Modal from './Modal.svelte';
	import Input from './Input.svelte';
	import { focusApi, type SessionType, type StudySession } from '$lib/api/focus';
	import { toasts } from '$lib/stores/ui';
	import { formatCountdown } from '$lib/utils/format';

	export let active: StudySession | null = null;

	const dispatch = createEventDispatcher<{
		started: StudySession;
		ended: StudySession;
		abandoned: StudySession;
	}>();

	let modalOpen = false;
	let type: SessionType = 'pomodoro';
	let minutes = 25;
	let note = '';
	let starting = false;

	let remaining = 0;
	let intervalId: ReturnType<typeof setInterval> | null = null;

	$: if (active) startCountdown();
	$: if (!active && intervalId) stopCountdown();

	function startCountdown() {
		stopCountdown();
		if (!active) return;
		const plannedEnd = new Date(active.startedAt).getTime() + active.plannedDurationS * 1000;
		const tick = () => {
			const left = Math.max(0, Math.floor((plannedEnd - Date.now()) / 1000));
			remaining = left;
		};
		tick();
		intervalId = setInterval(tick, 1000);
	}

	function stopCountdown() {
		if (intervalId) {
			clearInterval(intervalId);
			intervalId = null;
		}
	}

	onDestroy(stopCountdown);

	function openStart() {
		type = 'pomodoro';
		minutes = 25;
		note = '';
		modalOpen = true;
	}

	async function confirmStart() {
		starting = true;
		try {
			const session = await focusApi.start({
				type,
				plannedDurationS: Math.max(60, Math.round(minutes * 60)),
				note: note || undefined
			});
			active = session;
			modalOpen = false;
			toasts.success('Sessão iniciada');
			dispatch('started', session);
		} catch (err) {
			toasts.error('Não foi possível iniciar (API offline?)');
		} finally {
			starting = false;
		}
	}

	async function end() {
		if (!active) return;
		try {
			const updated = await focusApi.end(active.id);
			toasts.success('Sessão finalizada');
			dispatch('ended', updated);
			active = null;
		} catch {
			toasts.error('Falha ao finalizar');
		}
	}

	async function abandon() {
		if (!active) return;
		try {
			const updated = await focusApi.abandon(active.id);
			toasts.info('Sessão abandonada');
			dispatch('abandoned', updated);
			active = null;
		} catch {
			toasts.error('Falha ao abandonar');
		}
	}

	$: typePresets = [
		{ value: 'pomodoro' as const, label: 'Pomodoro', min: 25 },
		{ value: 'deep' as const, label: 'Deep work', min: 90 },
		{ value: 'custom' as const, label: 'Custom', min: 15 }
	];

	function pickPreset(t: SessionType, m: number) {
		type = t;
		minutes = m;
	}
</script>

<div class="card flex flex-col items-center gap-4 py-8">
	{#if active}
		<span class="badge">
			<span class="h-2 w-2 animate-pulse rounded-full bg-success" />
			{active.type} em andamento
		</span>
		<div class="font-mono text-7xl font-semibold text-slate-100 tabular-nums">
			{formatCountdown(remaining)}
		</div>
		<p class="text-xs text-muted">
			Planejado: {Math.round(active.plannedDurationS / 60)} min
			{#if active.note}— {active.note}{/if}
		</p>
		<div class="flex gap-2">
			<Button variant="primary" on:click={end}>
				<Square size={16} /> Finalizar
			</Button>
			<Button variant="ghost" on:click={abandon}>
				<XCircle size={16} /> Abandonar
			</Button>
		</div>
	{:else}
		<div class="font-mono text-7xl font-semibold text-muted tabular-nums">25:00</div>
		<p class="text-sm text-muted">Pronto para focar?</p>
		<Button variant="primary" size="lg" on:click={openStart}>
			<Play size={18} /> Start
		</Button>
	{/if}
</div>

<Modal bind:open={modalOpen} title="Iniciar sessão de foco">
	<div class="space-y-4">
		<div>
			<span class="label">Tipo</span>
			<div class="grid grid-cols-3 gap-2">
				{#each typePresets as p}
					<button
						type="button"
						class="rounded-md border p-3 text-sm transition-colors {type === p.value
							? 'border-accent bg-accent/10 text-accent'
							: 'border-surface-border bg-bg-sunken text-slate-300 hover:bg-surface-hover'}"
						on:click={() => pickPreset(p.value, p.min)}
					>
						<div class="font-medium">{p.label}</div>
						<div class="text-xs text-muted">{p.min} min</div>
					</button>
				{/each}
			</div>
		</div>
		<Input label="Duração (minutos)" type="number" min={1} max={240} bind:value={minutes} />
		<Input label="Anotação (opcional)" type="text" bind:value={note} placeholder="O que você vai estudar?" />
	</div>
	<svelte:fragment slot="footer">
		<Button variant="ghost" on:click={() => (modalOpen = false)}>Cancelar</Button>
		<Button variant="primary" loading={starting} on:click={confirmStart}>Começar</Button>
	</svelte:fragment>
</Modal>
