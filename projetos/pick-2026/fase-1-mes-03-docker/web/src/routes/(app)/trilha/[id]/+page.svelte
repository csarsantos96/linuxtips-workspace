<script lang="ts">
	import RoadmapGraph from '$lib/components/RoadmapGraph.svelte';
	import Empty from '$lib/components/Empty.svelte';
	import { trilhaApi, type NodeStatus, type RoadmapNode } from '$lib/api/trilha';
	import { toasts } from '$lib/stores/ui';
	import { Map } from 'lucide-svelte';

	export let data;

	let nodes: RoadmapNode[] = data.nodes;

	function nextStatus(s: NodeStatus): NodeStatus {
		if (s === 'todo') return 'learning';
		if (s === 'learning') return 'done';
		return 'todo';
	}

	async function toggle(e: CustomEvent<{ node: RoadmapNode }>) {
		const node = e.detail.node;
		const target = nextStatus(node.status);
		// optimistic
		nodes = nodes.map((n) => (n.id === node.id ? { ...n, status: target } : n));
		try {
			await trilhaApi.setNodeStatus(data.roadmapId, node.id, target);
		} catch {
			// rollback
			nodes = nodes.map((n) => (n.id === node.id ? { ...n, status: node.status } : n));
			toasts.error('Falha ao atualizar status');
		}
	}

	$: doneCount = nodes.filter((n) => n.status === 'done' && n.parentId).length;
	$: leafCount = nodes.filter((n) => n.parentId).length;
	$: pct = leafCount === 0 ? 0 : Math.round((doneCount / leafCount) * 100);
</script>

<svelte:head>
	<title>{data.roadmap?.title ?? 'Roadmap'} — PICKStack</title>
</svelte:head>

<section class="space-y-6">
	<header>
		<a href="/trilha" class="text-xs text-muted hover:text-slate-200">← Todos os roadmaps</a>
		<div class="mt-1 flex items-end justify-between gap-4">
			<div>
				<h1 class="text-2xl font-semibold text-slate-100">{data.roadmap?.title ?? 'Roadmap'}</h1>
				{#if data.roadmap?.description}
					<p class="text-sm text-muted">{data.roadmap.description}</p>
				{/if}
			</div>
			<div class="text-right">
				<div class="text-xs uppercase text-muted">Progresso</div>
				<div class="text-2xl font-semibold text-accent">{pct}%</div>
				<div class="text-xs text-muted">{doneCount} / {leafCount} nós</div>
			</div>
		</div>
	</header>

	{#if data.unavailable}
		<Empty variant="unavailable" title="trilha-svc indisponível" />
	{:else if nodes.length === 0}
		<Empty icon={Map} title="Roadmap vazio" description="Adicione nós para começar a trilhar." />
	{:else}
		<RoadmapGraph {nodes} on:toggle={toggle} />
	{/if}
</section>
