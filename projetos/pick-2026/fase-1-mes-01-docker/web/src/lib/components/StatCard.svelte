<script lang="ts">
	import type { ComponentType } from 'svelte';

	export let label: string;
	export let value: string | number;
	export let hint: string | undefined = undefined;
	export let icon: ComponentType | undefined = undefined;
	export let trend: 'up' | 'down' | 'flat' | undefined = undefined;
</script>

<div class="card flex flex-col gap-2">
	<div class="flex items-center justify-between">
		<span class="text-xs font-medium uppercase tracking-wide text-muted">{label}</span>
		{#if icon}
			<svelte:component this={icon} size={16} class="text-muted" />
		{/if}
	</div>
	<div class="flex items-baseline gap-2">
		<span class="text-2xl font-semibold text-slate-100">{value}</span>
		{#if trend === 'up'}
			<span class="text-xs text-success">↑</span>
		{:else if trend === 'down'}
			<span class="text-xs text-danger">↓</span>
		{/if}
	</div>
	{#if hint}
		<span class="text-xs text-muted">{hint}</span>
	{/if}
</div>
