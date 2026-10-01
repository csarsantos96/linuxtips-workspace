<script lang="ts">
	import { goto } from '$app/navigation';
	import { auth } from '$lib/stores/auth';
	import { authApi } from '$lib/api/auth';
	import { toasts } from '$lib/stores/ui';
	import Input from '$lib/components/Input.svelte';
	import Button from '$lib/components/Button.svelte';
	import { LogOut, KeyRound } from 'lucide-svelte';

	let oldPwd = '';
	let newPwd = '';
	let confirmPwd = '';
	let changing = false;
	let pwdError: string | null = null;

	async function changePassword(e: Event) {
		e.preventDefault();
		pwdError = null;
		if (newPwd.length < 8) {
			pwdError = 'Nova senha precisa de no mínimo 8 caracteres.';
			return;
		}
		if (newPwd !== confirmPwd) {
			pwdError = 'Confirmação não confere.';
			return;
		}
		changing = true;
		try {
			await authApi.changePassword(oldPwd, newPwd);
			toasts.success('Senha alterada');
			oldPwd = newPwd = confirmPwd = '';
		} catch {
			pwdError = 'Não foi possível alterar a senha.';
		} finally {
			changing = false;
		}
	}

	async function logout() {
		const rt = $auth.refreshToken;
		auth.clear();
		try {
			if (rt) await authApi.logout(rt);
		} catch {
			// ignore
		}
		goto('/login');
	}
</script>

<svelte:head><title>Configurações — PICKStack</title></svelte:head>

<section class="mx-auto max-w-2xl space-y-6">
	<header>
		<h1 class="text-2xl font-semibold text-slate-100">Configurações</h1>
		<p class="text-sm text-muted">Sua conta no PICKStack.</p>
	</header>

	<div class="card space-y-3">
		<h2 class="text-sm font-semibold uppercase tracking-wide text-muted">Perfil</h2>
		<dl class="grid grid-cols-[120px_1fr] gap-2 text-sm">
			<dt class="text-muted">Nome</dt>
			<dd class="text-slate-100">{$auth.user?.name ?? '—'}</dd>
			<dt class="text-muted">Email</dt>
			<dd class="text-slate-100">{$auth.user?.email ?? '—'}</dd>
			<dt class="text-muted">Tenant</dt>
			<dd class="font-mono text-xs text-muted">{$auth.user?.tenantId ?? '—'}</dd>
		</dl>
	</div>

	<form on:submit={changePassword} class="card space-y-4">
		<h2 class="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
			<KeyRound size={14} /> Trocar senha
		</h2>
		<p class="text-xs text-muted">
			Trocar a senha revoga todas as sessões ativas — você precisará entrar novamente.
		</p>
		<Input label="Senha atual" type="password" bind:value={oldPwd} autocomplete="current-password" />
		<Input
			label="Nova senha"
			type="password"
			bind:value={newPwd}
			autocomplete="new-password"
			hint="Mínimo 8 caracteres."
		/>
		<Input
			label="Confirmar nova senha"
			type="password"
			bind:value={confirmPwd}
			autocomplete="new-password"
			error={pwdError}
		/>
		<Button type="submit" variant="primary" loading={changing}>Alterar senha</Button>
	</form>

	<div class="card flex items-center justify-between">
		<div>
			<h2 class="text-sm font-semibold text-slate-100">Encerrar sessão</h2>
			<p class="text-xs text-muted">Você vai precisar entrar novamente.</p>
		</div>
		<Button variant="danger" on:click={logout}>
			<LogOut size={14} /> Sair
		</Button>
	</div>
</section>
