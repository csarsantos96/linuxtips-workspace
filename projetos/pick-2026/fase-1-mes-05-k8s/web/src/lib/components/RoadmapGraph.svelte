<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { ChevronRight, Circle, CircleDot, CircleCheck, ExternalLink } from 'lucide-svelte';
	import type { RoadmapNode, NodeStatus } from '$lib/api/trilha';

	export let nodes: RoadmapNode[] = [];

	const dispatch = createEventDispatcher<{ toggle: { node: RoadmapNode } }>();

	$: roots = nodes.filter((n) => !n.parentId).sort((a, b) => a.order - b.order);
	$: childrenMap = (() => {
		const m = new Map<string, RoadmapNode[]>();
		for (const n of nodes) {
			if (!n.parentId) continue;
			const arr = m.get(n.parentId) ?? [];
			arr.push(n);
			m.set(n.parentId, arr);
		}
		for (const arr of m.values()) arr.sort((a, b) => a.order - b.order);
		return m;
	})();

	function statusIcon(s: NodeStatus) {
		if (s === 'done') return CircleCheck;
		if (s === 'learning') return CircleDot;
		return Circle;
	}

	function statusColor(s: NodeStatus) {
		if (s === 'done') return 'text-success';
		if (s === 'learning') return 'text-warning';
		return 'text-muted';
	}
</script>

<div class="space-y-4">
	{#each roots as root (root.id)}
		<section class="card">
			<header class="mb-3 flex items-center justify-between">
				<h3 class="text-base font-semibold text-slate-100">{root.title}</h3>
				<span class="badge">
					{(childrenMap.get(root.id) ?? []).filter((c) => c.status === 'done').length}
					/
					{(childrenMap.get(root.id) ?? []).length}
				</span>
			</header>
			{#if root.description}
				<p class="mb-3 text-sm text-muted">{root.description}</p>
			{/if}
			<ul class="space-y-2">
				{#each childrenMap.get(root.id) ?? [] as node (node.id)}
					{@const Icon = statusIcon(node.status)}
					<li>
						<button
							type="button"
							class="flex w-full items-start gap-3 rounded-md border border-surface-border bg-bg-sunken p-3 text-left transition-colors hover:bg-surface-hover"
							on:click={() => dispatch('toggle', { node })}
						>
							<Icon size={18} class="mt-0.5 {statusColor(node.status)}" />
							<div class="flex-1 space-y-1">
								<div class="flex items-center gap-2">
									<span class="font-medium text-slate-100">{node.title}</span>
									<ChevronRight size={14} class="text-muted" />
									<span class="text-xs uppercase tracking-wide {statusColor(node.status)}">
										{node.status}
									</span>
								</div>
								{#if node.description}
									<p class="text-sm text-muted">{node.description}</p>
								{/if}
								{#if node.resources?.length}
									<ul class="mt-1 flex flex-wrap gap-2">
										{#each node.resources as r}
											<li>
												{#if r.url}
													<a
														href={r.url}
														target="_blank"
														rel="noopener noreferrer"
														class="inline-flex items-center gap-1 text-xs text-accent hover:underline"
														on:click|stopPropagation
													>
														<ExternalLink size={12} /> {r.title}
													</a>
												{:else}
													<span class="text-xs text-muted">{r.title}</span>
												{/if}
											</li>
										{/each}
									</ul>
								{/if}
							</div>
						</button>
					</li>
				{/each}
			</ul>
		</section>
	{/each}
</div>
