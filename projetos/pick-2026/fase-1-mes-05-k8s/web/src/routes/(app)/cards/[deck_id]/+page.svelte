<script lang="ts">
	import Button from '$lib/components/Button.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import Input from '$lib/components/Input.svelte';
	import Empty from '$lib/components/Empty.svelte';
	import { cardsApi, type Card } from '$lib/api/cards';
	import { toasts } from '$lib/stores/ui';
	import { formatDate } from '$lib/utils/format';
	import { Plus, Trash2, Pencil, BookOpen, Layers } from 'lucide-svelte';

	export let data;

	let cards: Card[] = data.cards;
	let modalOpen = false;
	let editing: Card | null = null;

	let front = '';
	let back = '';
	let tagsInput = '';
	let saving = false;

	function openNew() {
		editing = null;
		front = '';
		back = '';
		tagsInput = '';
		modalOpen = true;
	}

	function openEdit(c: Card) {
		editing = c;
		front = c.front;
		back = c.back;
		tagsInput = c.tags.join(', ');
		modalOpen = true;
	}

	async function save() {
		if (!front.trim() || !back.trim()) return;
		saving = true;
		const tags = tagsInput
			.split(',')
			.map((t) => t.trim())
			.filter(Boolean);
		try {
			if (editing) {
				const updated = await cardsApi.updateCard(data.deckId, editing.id, {
					front,
					back,
					tags
				});
				cards = cards.map((c) => (c.id === updated.id ? updated : c));
				toasts.success('Card atualizado');
			} else {
				const created = await cardsApi.createCard(data.deckId, { front, back, tags });
				cards = [created, ...cards];
				toasts.success('Card criado');
			}
			modalOpen = false;
		} catch {
			toasts.error('Falha ao salvar');
		} finally {
			saving = false;
		}
	}

	async function remove(c: Card) {
		if (!confirm(`Excluir o card "${c.front.slice(0, 40)}…"?`)) return;
		try {
			await cardsApi.deleteCard(data.deckId, c.id);
			cards = cards.filter((x) => x.id !== c.id);
			toasts.success('Card excluído');
		} catch {
			toasts.error('Falha ao excluir');
		}
	}
</script>

<svelte:head><title>{data.deck?.name ?? 'Deck'} — PICKStack</title></svelte:head>

<section class="space-y-6">
	<header class="flex items-end justify-between">
		<div>
			<a href="/cards" class="text-xs text-muted hover:text-slate-200">← Todos os decks</a>
			<h1 class="mt-1 text-2xl font-semibold text-slate-100">{data.deck?.name ?? 'Deck'}</h1>
			{#if data.deck?.description}
				<p class="text-sm text-muted">{data.deck.description}</p>
			{/if}
		</div>
		<div class="flex gap-2">
			<Button variant="ghost" href={`/cards/${data.deckId}/review`}>
				<BookOpen size={14} /> Estudar
			</Button>
			<Button variant="primary" on:click={openNew}>
				<Plus size={14} /> Card
			</Button>
		</div>
	</header>

	{#if data.unavailable}
		<Empty variant="unavailable" title="cards-svc indisponível" />
	{:else if cards.length === 0}
		<Empty
			icon={Layers}
			title="Nenhum card neste deck"
			description="Adicione cards com a frente (pergunta) e verso (resposta)."
		>
			<Button variant="primary" on:click={openNew}>
				<Plus size={14} /> Criar primeiro card
			</Button>
		</Empty>
	{:else}
		<div class="space-y-2">
			{#each cards as c (c.id)}
				<article class="card flex items-start gap-4">
					<div class="flex-1 space-y-2">
						<div class="text-sm text-slate-100"><span class="text-muted">Q:</span> {c.front}</div>
						<div class="text-sm text-slate-300"><span class="text-muted">A:</span> {c.back}</div>
						<div class="flex flex-wrap items-center gap-2 text-xs text-muted">
							{#each c.tags as tag}
								<span class="badge">{tag}</span>
							{/each}
							<span>· due {formatDate(c.dueAt)}</span>
							<span>· int. {c.intervalDays}d</span>
							<span>· ease {c.ease.toFixed(2)}</span>
						</div>
					</div>
					<div class="flex flex-col gap-1">
						<button
							class="rounded p-1.5 text-muted hover:bg-surface-hover hover:text-slate-200"
							on:click={() => openEdit(c)}
							aria-label="Editar"
						>
							<Pencil size={14} />
						</button>
						<button
							class="rounded p-1.5 text-muted hover:bg-surface-hover hover:text-danger"
							on:click={() => remove(c)}
							aria-label="Excluir"
						>
							<Trash2 size={14} />
						</button>
					</div>
				</article>
			{/each}
		</div>
	{/if}
</section>

<Modal bind:open={modalOpen} title={editing ? 'Editar card' : 'Novo card'} size="lg">
	<div class="space-y-4">
		<div>
			<span class="label">Frente</span>
			<textarea bind:value={front} class="input min-h-[80px]" placeholder="Pergunta ou conceito" />
		</div>
		<div>
			<span class="label">Verso</span>
			<textarea bind:value={back} class="input min-h-[80px]" placeholder="Resposta" />
		</div>
		<Input label="Tags (separadas por vírgula)" bind:value={tagsInput} placeholder="k8s, pods" />
	</div>
	<svelte:fragment slot="footer">
		<Button variant="ghost" on:click={() => (modalOpen = false)}>Cancelar</Button>
		<Button
			variant="primary"
			loading={saving}
			on:click={save}
			disabled={!front.trim() || !back.trim()}
		>
			{editing ? 'Salvar' : 'Criar'}
		</Button>
	</svelte:fragment>
</Modal>
