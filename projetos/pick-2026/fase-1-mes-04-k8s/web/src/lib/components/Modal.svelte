<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { X } from 'lucide-svelte';

	export let open = false;
	export let title = '';
	export let size: 'sm' | 'md' | 'lg' = 'md';

	const dispatch = createEventDispatcher<{ close: void }>();

	function close() {
		open = false;
		dispatch('close');
	}

	function onKey(e: KeyboardEvent) {
		if (e.key === 'Escape' && open) close();
	}

	const sizeClass = {
		sm: 'max-w-sm',
		md: 'max-w-lg',
		lg: 'max-w-2xl'
	};
</script>

<svelte:window on:keydown={onKey} />

{#if open}
	<!-- backdrop -->
	<div
		class="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
		on:click={close}
		on:keydown={(e) => e.key === 'Enter' && close()}
		role="button"
		tabindex="-1"
		aria-label="Fechar modal"
	></div>

	<div class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 pt-20">
		<div
			role="dialog"
			aria-modal="true"
			aria-labelledby="modal-title"
			class="card w-full {sizeClass[size]} animate-in fade-in"
		>
			<header class="mb-3 flex items-start justify-between gap-3">
				<h2 id="modal-title" class="text-lg font-semibold text-slate-100">{title}</h2>
				<button
					type="button"
					class="rounded p-1 text-muted hover:bg-surface-hover hover:text-slate-200"
					on:click={close}
					aria-label="Fechar"
				>
					<X size={18} />
				</button>
			</header>
			<div><slot /></div>
			{#if $$slots.footer}
				<footer class="mt-4 flex justify-end gap-2 border-t border-surface-border pt-3">
					<slot name="footer" />
				</footer>
			{/if}
		</div>
	</div>
{/if}
