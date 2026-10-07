<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { auth } from '$lib/stores/auth';
	import { authApi } from '$lib/api/auth';
	import { toasts, theme } from '$lib/stores/ui';

	let hydrated = !browser;

	onMount(async () => {
		// Aplica tema atual à árvore (caso o JS rode antes do CSS atributo).
		document.documentElement.classList.toggle('dark', $theme === 'dark');

		// Re-hidrata user a partir da API se temos token mas user pode estar stale.
		if ($auth.token && !$auth.user) {
			try {
				const user = await authApi.me();
				auth.setUser(user);
			} catch {
				// 401 já é tratado no client (redireciona pra /login).
			}
		}
		hydrated = true;
	});
</script>

<!-- Toasts globais -->
<div class="pointer-events-none fixed right-4 top-4 z-[60] flex w-72 flex-col gap-2">
	{#each $toasts as t (t.id)}
		<div
			class="pointer-events-auto rounded-md border px-3 py-2 text-sm shadow-lg
				{t.kind === 'success'
				? 'border-success/50 bg-success/10 text-success'
				: t.kind === 'error'
					? 'border-danger/50 bg-danger/10 text-danger'
					: 'border-accent/40 bg-accent/10 text-accent'}"
		>
			{t.message}
		</div>
	{/each}
</div>

{#if hydrated}
	<slot />
{:else}
	<div class="grid min-h-screen place-items-center">
		<div class="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
	</div>
{/if}
