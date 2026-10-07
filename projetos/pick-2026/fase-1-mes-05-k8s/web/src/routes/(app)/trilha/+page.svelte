<script lang="ts">
	import Button from '$lib/components/Button.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import Input from '$lib/components/Input.svelte';
	import Empty from '$lib/components/Empty.svelte';
	import { trilhaApi, type Roadmap } from '$lib/api/trilha';
	import { toasts } from '$lib/stores/ui';
	import { Plus, Map } from 'lucide-svelte';

	export let data;

	let roadmaps: Roadmap[] = data.roadmaps;
	let modalOpen = false;
	let saving = false;

	let title = '';
	let description = '';
	let isPublic = false;

	async function create() {
		if (!title.trim()) return;
		saving = true;
		try {
			const rm = await trilhaApi.create({
				title: title.trim(),
				description: description.trim() || undefined,
				isPublic
			});
			roadmaps = [rm, ...roadmaps];
			toasts.success('Roadmap criado');
			modalOpen = false;
			title = '';
			description = '';
			isPublic = false;
		} catch {
			toasts.error('Falha ao criar roadmap');
		} finally {
			saving = false;
		}
	}

	function progressPct(r: Roadmap) {
		if (r.nodeCount === 0) return 0;
		return Math.round((r.doneCount / r.nodeCount) * 100);
	}
</script>

<svelte:head><title>Trilha — PICKStack</title></svelte:head>

<section class="space-y-6">
	<header class="flex items-end justify-between">
		<div>
			<h1 class="text-2xl font-semibold text-slate-100">Trilha</h1>
			<p class="text-sm text-muted">Roadmaps de carreira e progresso por nó.</p>
		</div>
		<Button variant="primary" on:click={() => (modalOpen = true)}>
			<Plus size={16} /> Importar / Criar
		</Button>
	</header>

	{#if data.unavailable}
		<Empty
			variant="unavailable"
			title="trilha-svc indisponível"
			description="Suba o gateway + trilha-svc para listar roadmaps."
		/>
	{:else if roadmaps.length === 0}
		<Empty
			icon={Map}
			title="Nenhum roadmap ainda"
			description="Crie um roadmap próprio ou importe um público."
		>
			<Button variant="primary" on:click={() => (modalOpen = true)}>
				<Plus size={14} /> Criar roadmap
			</Button>
		</Empty>
	{:else}
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each roadmaps as r (r.id)}
				<a
					href={`/trilha/${r.id}`}
					class="card group flex flex-col gap-3 transition-colors hover:border-accent/40"
				>
					<header class="flex items-start justify-between gap-2">
						<h3 class="font-semibold text-slate-100 group-hover:text-accent">{r.title}</h3>
						{#if r.isPublic}
							<span class="badge text-accent">Public</span>
						{/if}
					</header>
					{#if r.description}
						<p class="line-clamp-2 text-sm text-muted">{r.description}</p>
					{/if}
					<div>
						<div class="flex items-center justify-between text-xs text-muted">
							<span>{r.doneCount}/{r.nodeCount} nós</span>
							<span class="text-slate-200">{progressPct(r)}%</span>
						</div>
						<div class="mt-1 h-1.5 overflow-hidden rounded-full bg-bg-sunken">
							<div
								class="h-full rounded-full bg-accent transition-all"
								style="width: {progressPct(r)}%"
							/>
						</div>
					</div>
				</a>
			{/each}
		</div>
	{/if}
</section>

<Modal bind:open={modalOpen} title="Novo roadmap">
	<div class="space-y-4">
		<Input label="Título" bind:value={title} placeholder="Ex: CKAD prep" />
		<Input label="Descrição" bind:value={description} placeholder="(opcional)" />
		<label class="flex items-center gap-2 text-sm text-slate-200">
			<input type="checkbox" bind:checked={isPublic} class="accent-accent" />
			Tornar público
		</label>
	</div>
	<svelte:fragment slot="footer">
		<Button variant="ghost" on:click={() => (modalOpen = false)}>Cancelar</Button>
		<Button variant="primary" loading={saving} on:click={create} disabled={!title.trim()}>
			Criar
		</Button>
	</svelte:fragment>
</Modal>
