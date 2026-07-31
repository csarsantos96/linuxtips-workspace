// Layout root: roda em client e server. Marca toda a árvore como CSR-friendly.
// A hidratação do auth store acontece em onMount no +layout.svelte.

export const ssr = true;
export const prerender = false;

export const load = async () => {
	return {};
};
