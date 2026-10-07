<script lang="ts">
	import { goto } from '$app/navigation';
	import { auth } from '$lib/stores/auth';
	import { authApi } from '$lib/api/auth';
	import { ApiError } from '$lib/api/client';
	import Input from '$lib/components/Input.svelte';
	import Button from '$lib/components/Button.svelte';
	import { toasts } from '$lib/stores/ui';

	let email = '';
	let password = '';
	let submitting = false;
	let errors: { email?: string; password?: string; form?: string } = {};

	function validate() {
		errors = {};
		if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errors.email = 'Email inválido.';
		if (password.length < 8) errors.password = 'Senha deve ter ao menos 8 caracteres.';
		return Object.keys(errors).length === 0;
	}

	async function onSubmit(e: Event) {
		e.preventDefault();
		if (!validate()) return;
		submitting = true;
		try {
			const res = await authApi.login(email, password);
			auth.login({ user: res.user, token: res.token, refreshToken: res.refresh_token });
			toasts.success(`Bem-vindo, ${res.user.name ?? res.user.email}`);
			goto('/dashboard');
		} catch (err) {
			if (err instanceof ApiError) {
				if (err.status === 401 || err.status === 400) errors.form = 'Credenciais inválidas.';
				else if (err.status === 0) errors.form = 'API indisponível. Verifique se o gateway está rodando.';
				else errors.form = err.message;
			} else {
				errors.form = 'Erro inesperado.';
			}
		} finally {
			submitting = false;
		}
	}
</script>

<svelte:head><title>Entrar — PICKStack</title></svelte:head>

<div class="grid min-h-screen place-items-center bg-bg px-4">
	<form on:submit={onSubmit} class="card w-full max-w-sm space-y-4" novalidate>
		<a href="/" class="flex justify-center">
			<img src="/logo.svg" alt="PICKStack" class="h-8" />
		</a>

		<div class="space-y-1 text-center">
			<h1 class="text-xl font-semibold text-slate-100">Entrar</h1>
			<p class="text-sm text-muted">Acesse sua conta PICKStack</p>
		</div>

		<Input
			label="Email"
			type="email"
			autocomplete="email"
			bind:value={email}
			error={errors.email}
			required
		/>
		<Input
			label="Senha"
			type="password"
			autocomplete="current-password"
			bind:value={password}
			error={errors.password}
			required
		/>

		{#if errors.form}
			<div class="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
				{errors.form}
			</div>
		{/if}

		<Button type="submit" variant="primary" loading={submitting} disabled={submitting}>
			Entrar
		</Button>

		<p class="text-center text-xs text-muted">
			Sem conta?
			<a href="/signup" class="text-accent hover:underline">Crie uma agora</a>
		</p>
	</form>
</div>
