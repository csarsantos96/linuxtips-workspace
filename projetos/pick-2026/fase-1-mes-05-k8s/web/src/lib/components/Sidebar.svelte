<script lang="ts">
	import { page } from '$app/stores';
	import { sidebarCollapsed } from '$lib/stores/ui';
	import {
		LayoutDashboard,
		Timer,
		Layers,
		Map,
		Settings,
		PanelLeftClose,
		PanelLeftOpen
	} from 'lucide-svelte';

	const items = [
		{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
		{ href: '/focus', label: 'Focus', icon: Timer },
		{ href: '/cards', label: 'Cards', icon: Layers },
		{ href: '/trilha', label: 'Trilha', icon: Map },
		{ href: '/settings', label: 'Configurações', icon: Settings }
	];

	$: pathname = $page.url.pathname;

	function isActive(href: string) {
		if (href === '/dashboard') return pathname === '/dashboard' || pathname === '/';
		return pathname === href || pathname.startsWith(href + '/');
	}
</script>

<aside
	class="flex h-full flex-col border-r border-surface-border bg-bg-soft transition-all"
	class:w-60={!$sidebarCollapsed}
	class:w-16={$sidebarCollapsed}
>
	<div class="flex items-center justify-between gap-2 px-3 py-4">
		{#if !$sidebarCollapsed}
			<a href="/dashboard" class="flex items-center gap-2 text-slate-100">
				<img src="/logo.svg" alt="PICKStack" class="h-7" />
			</a>
		{:else}
			<a href="/dashboard" class="mx-auto">
				<img src="/favicon.svg" alt="PICKStack" class="h-7 w-7" />
			</a>
		{/if}
		<button
			type="button"
			class="rounded p-1 text-muted hover:bg-surface-hover hover:text-slate-200"
			on:click={() => sidebarCollapsed.update((v) => !v)}
			aria-label="Alternar sidebar"
		>
			{#if $sidebarCollapsed}
				<PanelLeftOpen size={16} />
			{:else}
				<PanelLeftClose size={16} />
			{/if}
		</button>
	</div>

	<nav class="flex-1 space-y-1 px-2">
		{#each items as item}
			{@const active = isActive(item.href)}
			<a
				href={item.href}
				class="flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors
					{active
					? 'bg-accent/10 text-accent'
					: 'text-slate-300 hover:bg-surface-hover hover:text-slate-100'}"
				title={item.label}
			>
				<svelte:component this={item.icon} size={18} />
				{#if !$sidebarCollapsed}
					<span>{item.label}</span>
				{/if}
			</a>
		{/each}
	</nav>

	<div class="px-3 py-3 text-[10px] uppercase tracking-wide text-muted-soft">
		{#if !$sidebarCollapsed}
			<span>PICKStack v0.1 · MVP</span>
		{/if}
	</div>
</aside>
