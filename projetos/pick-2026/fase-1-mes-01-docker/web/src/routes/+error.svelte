<script lang="ts">
	import { page } from '$app/stores';
	import Button from '$lib/components/Button.svelte';
</script>

<div class="grid min-h-screen place-items-center bg-bg px-4">
	<div class="card max-w-md text-center">
		<p class="text-xs uppercase tracking-wide text-muted">Erro</p>
		<h1 class="mt-2 text-3xl font-bold text-slate-100">{$page.status}</h1>
		<p class="mt-2 text-sm text-muted">
			{$page.error?.message ?? 'Algo deu errado.'}
		</p>
		<div class="mt-6 flex justify-center gap-2">
			<Button href="/" variant="primary">Voltar ao início</Button>
		</div>
	</div>
</div>
