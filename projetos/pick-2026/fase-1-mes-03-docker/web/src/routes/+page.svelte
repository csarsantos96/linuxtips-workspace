<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { auth } from '$lib/stores/auth';
	import Button from '$lib/components/Button.svelte';
	import { Timer, Layers, Map, ArrowRight, Github } from 'lucide-svelte';

	onMount(() => {
		// Se já autenticado, manda direto pro dashboard.
		if ($auth.token && $auth.user) {
			goto('/dashboard', { replaceState: true });
		}
	});

	const modules = [
		{
			icon: Timer,
			title: 'focus',
			description: 'Sessões pomodoro, streak diário e heatmap de produtividade.'
		},
		{
			icon: Layers,
			title: 'cards',
			description: 'Flashcards com repetição espaçada (SM-2) — você lembra do que estudou.'
		},
		{
			icon: Map,
			title: 'trilha',
			description: 'Roadmaps de carreira com progresso por nó. Saiba onde está e onde ir.'
		}
	];
</script>

<div class="flex min-h-screen flex-col bg-bg">
	<header class="flex items-center justify-between px-6 py-4">
		<a href="/" class="flex items-center gap-2">
			<img src="/logo.svg" alt="PICKStack" class="h-8" />
		</a>
		<div class="flex items-center gap-2">
			<Button variant="ghost" href="/login">Entrar</Button>
			<Button variant="primary" href="/signup">Criar conta</Button>
		</div>
	</header>

	<section class="mx-auto flex max-w-4xl flex-1 flex-col justify-center px-6 py-16 text-center">
		<span class="mx-auto badge">PICK 2026 · LINUXtips</span>
		<h1 class="mt-6 text-balance text-5xl font-bold tracking-tight text-slate-100 sm:text-6xl">
			Operações de estudo,
			<span class="text-accent">cloud-native</span>.
		</h1>
		<p class="mx-auto mt-6 max-w-2xl text-pretty text-lg text-muted">
			PICKStack é a plataforma modular que os alunos do PICK 2026 não só usam para organizar
			estudo — eles a <strong class="text-slate-200">operam</strong>: empacotam containers, escrevem
			manifestos K8s, configuram ArgoCD e investigam incidentes em produção.
		</p>
		<div class="mt-8 flex flex-wrap justify-center gap-3">
			<Button variant="primary" size="lg" href="/signup">
				Começar agora <ArrowRight size={16} />
			</Button>
			<Button
				variant="ghost"
				size="lg"
				href="https://github.com/linuxtips/pickstack"
			>
				<Github size={16} /> Ver no GitHub
			</Button>
		</div>

		<div class="mt-16 grid gap-4 sm:grid-cols-3">
			{#each modules as m}
				<div class="card text-left">
					<svelte:component this={m.icon} size={20} class="text-accent" />
					<h3 class="mt-3 font-semibold text-slate-100">{m.title}</h3>
					<p class="mt-1 text-sm text-muted">{m.description}</p>
				</div>
			{/each}
		</div>
	</section>

	<footer class="border-t border-surface-border px-6 py-4 text-center text-xs text-muted">
		Feito com 💜 pela comunidade LINUXtips — MIT License
	</footer>
</div>
