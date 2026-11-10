<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { ChevronRight, Circle, CircleDot, CircleCheck, ExternalLink } from 'lucide-svelte';
	import type { RoadmapNode, NodeStatus } from '$lib/api/trilha';

	export let nodes: RoadmapNode[] = [];

	const dispatch = createEventDispatcher<{ toggle: { node: RoadmapNode } }>();

	$: ordered = [...nodes].sort((a, b) => a.order - b.order);

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

<ol class="space-y-3">
	{#each ordered as node (node.id)}
		{@const Icon = statusIcon(node.status)}
		<li class="card min-w-0">
			<button
				type="button"
				class="flex min-h-12 w-full items-start gap-3 rounded-md p-2 text-left transition-colors hover:bg-surface-hover"
				aria-label={`${node.title}: ${node.status}. Avançar status`}
				on:click={() => dispatch('toggle', { node })}
			>
				<Icon size={18} class="mt-0.5 shrink-0 {statusColor(node.status)}" />
				<div class="min-w-0 flex-1 space-y-1">
					<div class="flex flex-wrap items-center gap-2">
						<span class="break-words font-medium text-slate-100">{node.title}</span>
						<ChevronRight size={14} class="text-muted" />
						<span class="text-xs uppercase {statusColor(node.status)}">{node.status}</span>
					</div>
					{#if node.description}<p class="text-sm text-muted">{node.description}</p>{/if}
				</div>
			</button>
			{#if node.resources?.length}
				<ul class="mt-2 flex flex-wrap gap-3 px-2">
					{#each node.resources as r}
						<li>
							{#if r.url}<a
									href={r.url}
									target="_blank"
									rel="noopener noreferrer"
									class="inline-flex min-h-10 items-center gap-1 text-xs text-accent hover:underline"
									><ExternalLink size={12} />{r.title}</a
								>{:else}<span class="text-xs text-muted">{r.title}</span>{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</li>
	{/each}
</ol>
