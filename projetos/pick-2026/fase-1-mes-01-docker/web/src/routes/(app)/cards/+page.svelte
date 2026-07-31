<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import Button from '$lib/components/Button.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import Input from '$lib/components/Input.svelte';
	import Empty from '$lib/components/Empty.svelte';
	import { cardsApi, type Deck } from '$lib/api/cards';
	import { toasts } from '$lib/stores/ui';
	import { Plus, Layers, BookOpen } from 'lucide-svelte';

	export let data;

	let decks: Deck[] = data.decks;
	let modalOpen = false;
	let saving = false;

	let name = '';
	let description = '';
	let isPublic = false;

	async function createDeck() {
		if (!name.trim()) return;
		saving = true;
		try {
			const deck = await cardsApi.createDeck({
				name: name.trim(),
				description: description.trim() || undefined,
				isPublic
			});
			decks = [deck, ...decks];
			toasts.success('Deck criado');
			modalOpen = false;
			name = '';
			description = '';
			isPublic = false;
			await invalidateAll();
		} catch {
			toasts.error('Falha ao criar deck');
		} finally {
			saving = false;
		}
	}
</script>

<svelte:head><title>Cards — PICKStack</title></svelte:head>

<section class="space-y-6">
	<header class="flex items-end justify-between">
		<div>
			<h1 class="text-2xl font-semibold text-slate-100">Cards</h1>
			<p class="text-sm text-muted">Decks de flashcards com repetição espaçada (SM-2).</p>
		</div>
		<Button variant="primary" on:click={() => (modalOpen = true)}>
			<Plus size={16} /> Novo deck
		</Button>
	</header>

	{#if data.unavailable}
		<Empty
			variant="unavailable"
			title="cards-svc indisponível"
			description="Não foi possível carregar seus decks."
		/>
	{:else if decks.length === 0}
		<Empty
			icon={Layers}
			title="Nenhum deck ainda"
			description="Crie seu primeiro deck para começar a estudar."
		>
			<Button variant="primary" on:click={() => (modalOpen = true)}>
				<Plus size={14} /> Criar deck
			</Button>
		</Empty>
	{:else}
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each decks as deck (deck.id)}
				<article class="card flex flex-col gap-3">
					<header class="flex items-start justify-between gap-2">
						<h3 class="font-semibold text-slate-100">{deck.name}</h3>
						{#if deck.isPublic}
							<span class="badge text-accent">Public</span>
						{/if}
					</header>
					<p class="line-clamp-2 text-sm text-muted">
						{deck.description || 'Sem descrição.'}
					</p>
					<dl class="flex items-center gap-4 text-xs text-muted">
						<div>
							<dt class="uppercase">Cards</dt>
							<dd class="text-slate-200">{deck.cardCount}</dd>
						</div>
						<div>
							<dt class="uppercase">Due hoje</dt>
							<dd
								class="font-medium"
								class:text-success={deck.dueCount > 0}
								class:text-slate-200={deck.dueCount === 0}
							>
								{deck.dueCount}
							</dd>
						</div>
					</dl>
					<footer class="flex gap-2">
						<Button variant="primary" size="sm" href={`/cards/${deck.id}/review`}>
							<BookOpen size={14} /> Estudar
						</Button>
						<Button variant="ghost" size="sm" href={`/cards/${deck.id}`}>Gerenciar</Button>
					</footer>
				</article>
			{/each}
		</div>
	{/if}
</section>

<Modal bind:open={modalOpen} title="Novo deck">
	<div class="space-y-4">
		<Input label="Nome" bind:value={name} placeholder="Ex: Kubernetes core concepts" />
		<Input label="Descrição" bind:value={description} placeholder="(opcional)" />
		<label class="flex items-center gap-2 text-sm text-slate-200">
			<input type="checkbox" bind:checked={isPublic} class="accent-accent" />
			Tornar público
		</label>
	</div>
	<svelte:fragment slot="footer">
		<Button variant="ghost" on:click={() => (modalOpen = false)}>Cancelar</Button>
		<Button variant="primary" loading={saving} on:click={createDeck} disabled={!name.trim()}>
			Criar
		</Button>
	</svelte:fragment>
</Modal>
