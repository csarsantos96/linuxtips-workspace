<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import Topbar from '$lib/components/Topbar.svelte';
	import { auth } from '$lib/stores/auth';

	onMount(() => {
		// Guard simples — se não há token, manda para /login.
		if (!$auth.token) {
			goto('/login', { replaceState: true });
		}
	});
</script>

{#if $auth.token}
	<div class="flex h-screen w-screen overflow-hidden bg-bg">
		<Sidebar />
		<div class="flex min-w-0 flex-1 flex-col">
			<Topbar />
			<main class="flex-1 overflow-y-auto p-6">
				<slot />
			</main>
		</div>
	</div>
{:else}
	<div class="grid min-h-screen place-items-center">
		<div class="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
	</div>
{/if}
