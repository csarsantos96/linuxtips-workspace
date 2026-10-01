<script lang="ts">
	type Variant = 'primary' | 'ghost' | 'danger';
	type Size = 'sm' | 'md' | 'lg';

	export let variant: Variant = 'primary';
	export let size: Size = 'md';
	export let type: 'button' | 'submit' | 'reset' = 'button';
	export let disabled = false;
	export let loading = false;
	export let href: string | null = null;

	const variantClass: Record<Variant, string> = {
		primary: 'btn-primary',
		ghost: 'btn-ghost',
		danger: 'btn-danger'
	};
	const sizeClass: Record<Size, string> = {
		sm: 'px-2 py-1 text-xs',
		md: 'px-3 py-2 text-sm',
		lg: 'px-4 py-2.5 text-base'
	};
</script>

{#if href}
	<a
		{href}
		class="btn {variantClass[variant]} {sizeClass[size]}"
		class:pointer-events-none={disabled || loading}
		aria-disabled={disabled || loading}
	>
		<slot />
	</a>
{:else}
	<button
		{type}
		on:click
		class="btn {variantClass[variant]} {sizeClass[size]}"
		disabled={disabled || loading}
	>
		{#if loading}
			<span class="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
		{/if}
		<slot />
	</button>
{/if}
