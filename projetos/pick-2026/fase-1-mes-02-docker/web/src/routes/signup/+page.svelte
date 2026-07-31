<script lang="ts">
	import { goto } from '$app/navigation';
	import { auth } from '$lib/stores/auth';
	import { authApi } from '$lib/api/auth';
	import { ApiError } from '$lib/api/client';
	import Input from '$lib/components/Input.svelte';
	import Button from '$lib/components/Button.svelte';
	import { toasts } from '$lib/stores/ui';

	let name = '';
	let email = '';
	let password = '';
	let submitting = false;
	let errors: { name?: string; email?: string; password?: string; form?: string } = {};

	function validate() {
		errors = {};
		if (name.trim().length < 2) errors.name = 'Diga seu nome (mínimo 2 caracteres).';
		if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errors.email = 'Email inválido.';
		if (password.length < 8) errors.password = 'Senha deve ter ao menos 8 caracteres.';
		return Object.keys(errors).length === 0;
	}

	async function onSubmit(e: Event) {
		e.preventDefault();
		if (!validate()) return;
		submitting = true;
		try {
			const res = await authApi.signup(email, password, name.trim());
			auth.login({ user: res.user, token: res.token, refreshToken: res.refresh_token });
			toasts.success('Conta criada!');
			goto('/dashboard');
		} catch (err) {
			if (err instanceof ApiError) {
				if (err.status === 409) errors.form = 'Já existe uma conta com esse email.';
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

<svelte:head><title>Criar conta — PICKStack</title></svelte:head>

<div class="grid min-h-screen place-items-center bg-bg px-4">
	<form on:submit={onSubmit} class="card w-full max-w-sm space-y-4" novalidate>
		<a href="/" class="flex justify-center">
			<img src="/logo.svg" alt="PICKStack" class="h-8" />
		</a>

		<div class="space-y-1 text-center">
			<h1 class="text-xl font-semibold text-slate-100">Criar conta</h1>
			<p class="text-sm text-muted">Bem-vindo ao PICK 2026</p>
		</div>

		<Input label="Nome" type="text" bind:value={name} error={errors.name} autocomplete="name" required />
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
			autocomplete="new-password"
			bind:value={password}
			error={errors.password}
			hint="Mínimo 8 caracteres."
			required
		/>

		{#if errors.form}
			<div class="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
				{errors.form}
			</div>
		{/if}

		<Button type="submit" variant="primary" loading={submitting} disabled={submitting}>
			Criar conta
		</Button>

		<p class="text-center text-xs text-muted">
			Já tem conta?
			<a href="/login" class="text-accent hover:underline">Entrar</a>
		</p>
	</form>
</div>
