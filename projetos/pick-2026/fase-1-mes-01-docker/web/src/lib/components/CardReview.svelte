<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { Card, ReviewQuality } from '$lib/api/cards';
	import Button from './Button.svelte';

	export let card: Card;
	export let index = 0;
	export let total = 0;

	let revealed = false;

	const dispatch = createEventDispatcher<{ rate: { card: Card; quality: ReviewQuality } }>();

	function rate(q: ReviewQuality) {
		dispatch('rate', { card, quality: q });
		revealed = false;
	}

	$: revealed = false;
	$: card, (revealed = false);

	const qualities: { value: ReviewQuality; label: string; color: string }[] = [
		{ value: 0, label: '0 · Errei', color: 'bg-danger/80 hover:bg-danger text-white' },
		{ value: 1, label: '1 · Difícil', color: 'bg-danger/40 hover:bg-danger/60 text-white' },
		{ value: 2, label: '2 · Quase', color: 'bg-warning/40 hover:bg-warning/60 text-bg' },
		{ value: 3, label: '3 · Ok', color: 'bg-warning/70 hover:bg-warning text-bg' },
		{ value: 4, label: '4 · Bom', color: 'bg-success/60 hover:bg-success/80 text-bg' },
		{ value: 5, label: '5 · Fácil', color: 'bg-success hover:bg-success/90 text-bg' }
	];
</script>

<div class="card flex flex-col gap-6">
	<div class="flex items-center justify-between text-xs text-muted">
		<span>Card {index + 1} de {total}</span>
		{#if card.tags.length}
			<div class="flex gap-1">
				{#each card.tags as tag}
					<span class="badge">{tag}</span>
				{/each}
			</div>
		{/if}
	</div>

	<div class="rounded-md border border-surface-border bg-bg-sunken p-6 text-lg">
		<div class="text-xs uppercase tracking-wide text-muted">Frente</div>
		<div class="mt-2 whitespace-pre-wrap text-slate-100">{card.front}</div>
	</div>

	{#if revealed}
		<div class="rounded-md border border-success/40 bg-success/5 p-6 text-lg">
			<div class="text-xs uppercase tracking-wide text-success">Verso</div>
			<div class="mt-2 whitespace-pre-wrap text-slate-100">{card.back}</div>
		</div>

		<div class="grid grid-cols-3 gap-2 sm:grid-cols-6">
			{#each qualities as q}
				<button
					class="rounded-md px-3 py-2 text-sm font-medium transition-colors {q.color}"
					on:click={() => rate(q.value)}
				>
					{q.label}
				</button>
			{/each}
		</div>
	{:else}
		<div class="flex justify-center">
			<Button variant="primary" size="lg" on:click={() => (revealed = true)}>
				Mostrar resposta
			</Button>
		</div>
	{/if}
</div>
