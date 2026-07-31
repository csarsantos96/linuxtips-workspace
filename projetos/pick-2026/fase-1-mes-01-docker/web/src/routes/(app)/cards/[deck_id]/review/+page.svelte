<script lang="ts">
	import CardReview from '$lib/components/CardReview.svelte';
	import Empty from '$lib/components/Empty.svelte';
	import Button from '$lib/components/Button.svelte';
	import { cardsApi, type Card, type ReviewQuality } from '$lib/api/cards';
	import { toasts } from '$lib/stores/ui';
	import { CheckCircle2, BookOpen } from 'lucide-svelte';

	export let data;

	let queue: Card[] = data.queue;
	let cursor = 0;
	let submitting = false;

	$: current = queue[cursor];

	async function onRate(e: CustomEvent<{ card: Card; quality: ReviewQuality }>) {
		if (submitting) return;
		submitting = true;
		try {
			await cardsApi.review(e.detail.card.id, e.detail.quality);
			cursor++;
		} catch {
			toasts.error('Falha ao enviar review (offline?). Avançando localmente.');
			cursor++;
		} finally {
			submitting = false;
		}
	}
</script>

<svelte:head>
	<title>Revisar {data.deck?.name ?? ''} — PICKStack</title>
</svelte:head>

<section class="mx-auto max-w-2xl space-y-6">
	<header>
		<a href={`/cards/${data.deckId}`} class="text-xs text-muted hover:text-slate-200"
			>← {data.deck?.name ?? 'Deck'}</a
		>
		<h1 class="mt-1 text-2xl font-semibold text-slate-100">Sessão de review</h1>
	</header>

	{#if data.unavailable}
		<Empty variant="unavailable" title="cards-svc indisponível" />
	{:else if queue.length === 0}
		<Empty
			icon={CheckCircle2}
			title="Nada para revisar agora"
			description="Volte mais tarde quando houver cards no due."
		>
			<Button variant="primary" href={`/cards/${data.deckId}`}>Voltar ao deck</Button>
		</Empty>
	{:else if cursor >= queue.length}
		<div class="card flex flex-col items-center gap-4 py-12 text-center">
			<CheckCircle2 size={48} class="text-success" />
			<h2 class="text-xl font-semibold text-slate-100">Sessão concluída!</h2>
			<p class="text-sm text-muted">Você revisou {queue.length} cards.</p>
			<div class="flex gap-2">
				<Button variant="ghost" href={`/cards/${data.deckId}`}>Voltar ao deck</Button>
				<Button variant="primary" on:click={() => location.reload()}>
					<BookOpen size={14} /> Mais uma rodada
				</Button>
			</div>
		</div>
	{:else if current}
		<CardReview card={current} index={cursor} total={queue.length} on:rate={onRate} />
	{/if}
</section>
