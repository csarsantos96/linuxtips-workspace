<script lang="ts">
	import { Inbox } from 'lucide-svelte';
	import type { ComponentType } from 'svelte';

	export let title = 'Nada por aqui ainda';
	export let description = '';
	export let icon: ComponentType = Inbox;
	export let variant: 'default' | 'unavailable' = 'default';
</script>

<div
	class="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-surface-border bg-bg-soft/40 p-8 text-center"
>
	<div
		class="rounded-full p-3 {variant === 'unavailable'
			? 'bg-warning/10 text-warning'
			: 'bg-surface text-muted'}"
	>
		<svelte:component this={icon} size={28} />
	</div>
	<div class="space-y-1">
		<h3 class="text-base font-semibold text-slate-100">{title}</h3>
		{#if description}
			<p class="max-w-sm text-sm text-muted">{description}</p>
		{/if}
	</div>
	{#if $$slots.default}
		<div class="pt-2"><slot /></div>
	{/if}
</div>
