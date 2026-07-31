<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';

	type $$Props = Omit<HTMLInputAttributes, 'id' | 'value'> & {
		label?: string;
		error?: string | null;
		hint?: string;
		value?: string | number | null;
	};

	export let label: string | undefined = undefined;
	export let error: string | null | undefined = null;
	export let hint: string | undefined = undefined;
	export let value: string | number | null = '';
	export let id: string | undefined = undefined;

	const inputId = id ?? `i-${Math.random().toString(36).slice(2, 9)}`;
</script>

<div class="flex flex-col gap-1">
	{#if label}
		<label for={inputId} class="label">{label}</label>
	{/if}
	<input
		{...$$restProps}
		id={inputId}
		bind:value
		class="input"
		class:border-danger={!!error}
		on:input
		on:change
		on:focus
		on:blur
	/>
	{#if error}
		<p class="text-xs text-danger">{error}</p>
	{:else if hint}
		<p class="text-xs text-muted">{hint}</p>
	{/if}
</div>
