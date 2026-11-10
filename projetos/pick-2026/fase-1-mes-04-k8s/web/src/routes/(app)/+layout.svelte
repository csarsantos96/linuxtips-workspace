<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import Topbar from '$lib/components/Topbar.svelte';
	import { page } from '$app/stores';
	import { LayoutDashboard, Timer, Layers, Map, Settings } from 'lucide-svelte';
	import { auth } from '$lib/stores/auth';

	const mobileItems = [
		{ href: '/dashboard', label: 'Início', icon: LayoutDashboard },
		{ href: '/focus', label: 'Focus', icon: Timer },
		{ href: '/cards', label: 'Cards', icon: Layers },
		{ href: '/trilha', label: 'Trilha', icon: Map },
		{ href: '/settings', label: 'Config', icon: Settings }
	];
	onMount(() => {
		// Guard simples — se não há token, manda para /login.
		if (!$auth.token) {
			goto('/login', { replaceState: true });
		}
	});
</script>

{#if $auth.token}
	<div class="flex h-dvh w-full overflow-hidden bg-bg">
		<div class="hidden shrink-0 md:block"><Sidebar /></div>
		<div class="flex min-w-0 flex-1 flex-col">
			<Topbar />
			<main class="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
				<slot />
			</main>
			<nav
				aria-label="Navegação principal"
				class="grid shrink-0 grid-cols-5 border-t border-surface-border bg-bg-soft pb-[env(safe-area-inset-bottom)] md:hidden"
			>
				{#each mobileItems as item}
					<a
						href={item.href}
						aria-current={$page.url.pathname.startsWith(item.href) ? 'page' : undefined}
						class="flex min-h-16 flex-col items-center justify-center gap-1 text-xs {$page.url.pathname.startsWith(
							item.href
						)
							? 'text-accent'
							: 'text-slate-300'}"
					>
						<svelte:component this={item.icon} size={20} />{item.label}
					</a>
				{/each}
			</nav>
		</div>
	</div>
{:else}
	<div class="grid min-h-screen place-items-center">
		<div class="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
	</div>
{/if}
