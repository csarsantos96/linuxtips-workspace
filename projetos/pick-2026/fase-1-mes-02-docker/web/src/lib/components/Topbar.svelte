<script lang="ts">
	import { goto } from '$app/navigation';
	import { auth } from '$lib/stores/auth';
	import { theme, toggleTheme } from '$lib/stores/ui';
	import { authApi } from '$lib/api/auth';
	import { Moon, Sun, LogOut, User as UserIcon } from 'lucide-svelte';

	let menuOpen = false;

	async function handleLogout() {
		const rt = $auth.refreshToken;
		auth.clear();
		try {
			if (rt) await authApi.logout(rt);
		} catch {
			// silencioso — sessão local já foi limpa.
		}
		goto('/login');
	}

	function close() {
		menuOpen = false;
	}
</script>

<header
	class="flex h-14 items-center justify-between border-b border-surface-border bg-bg-soft px-4"
>
	<div class="text-sm text-muted">
		<slot name="left" />
	</div>

	<div class="flex items-center gap-2">
		<button
			type="button"
			class="rounded-md p-2 text-muted hover:bg-surface-hover hover:text-slate-200"
			on:click={toggleTheme}
			aria-label="Alternar tema"
			title="Alternar tema"
		>
			{#if $theme === 'dark'}
				<Sun size={16} />
			{:else}
				<Moon size={16} />
			{/if}
		</button>

		<div class="relative">
			<button
				type="button"
				class="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-200 hover:bg-surface-hover"
				on:click={() => (menuOpen = !menuOpen)}
			>
				<span class="grid h-7 w-7 place-items-center rounded-full bg-accent/20 text-accent">
					<UserIcon size={14} />
				</span>
				<span class="hidden sm:inline">{$auth.user?.name ?? $auth.user?.email ?? 'Usuário'}</span>
			</button>

			{#if menuOpen}
				<!-- click outside -->
				<button
					type="button"
					class="fixed inset-0 z-30"
					aria-label="Fechar menu"
					on:click={close}
				></button>
				<div
					class="absolute right-0 z-40 mt-1 w-48 overflow-hidden rounded-md border border-surface-border bg-bg-soft shadow-lg"
				>
					<a
						href="/settings"
						class="block px-3 py-2 text-sm text-slate-200 hover:bg-surface-hover"
						on:click={close}
					>
						Configurações
					</a>
					<button
						type="button"
						class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-danger hover:bg-surface-hover"
						on:click={handleLogout}
					>
						<LogOut size={14} /> Sair
					</button>
				</div>
			{/if}
		</div>
	</div>
</header>
