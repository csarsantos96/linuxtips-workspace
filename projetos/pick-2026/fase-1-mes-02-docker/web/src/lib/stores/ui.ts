// Estado de UI compartilhado (sidebar, tema, toasts).

import { browser } from '$app/environment';
import { writable } from 'svelte/store';

export interface Toast {
	id: number;
	kind: 'info' | 'success' | 'error';
	message: string;
}

/* -------------------------------- sidebar -------------------------------- */

const sidebarKey = 'pickstack.sidebarCollapsed';
const sidebarInitial = browser ? localStorage.getItem(sidebarKey) === '1' : false;
export const sidebarCollapsed = writable<boolean>(sidebarInitial);
if (browser) {
	sidebarCollapsed.subscribe((v) => localStorage.setItem(sidebarKey, v ? '1' : '0'));
}

/* --------------------------------- tema --------------------------------- */

export type Theme = 'dark' | 'light';
const themeKey = 'pickstack.theme';
const themeInitial: Theme = browser
	? ((localStorage.getItem(themeKey) as Theme | null) ?? 'dark')
	: 'dark';
export const theme = writable<Theme>(themeInitial);

if (browser) {
	theme.subscribe((value) => {
		localStorage.setItem(themeKey, value);
		document.documentElement.classList.toggle('dark', value === 'dark');
	});
}

export function toggleTheme() {
	theme.update((t) => (t === 'dark' ? 'light' : 'dark'));
}

/* -------------------------------- toasts -------------------------------- */

function createToastStore() {
	const { subscribe, update } = writable<Toast[]>([]);
	let counter = 0;

	function push(kind: Toast['kind'], message: string, ttlMs = 4000) {
		const id = ++counter;
		update((list) => [...list, { id, kind, message }]);
		if (browser) {
			setTimeout(() => {
				update((list) => list.filter((t) => t.id !== id));
			}, ttlMs);
		}
	}

	return {
		subscribe,
		info: (m: string) => push('info', m),
		success: (m: string) => push('success', m),
		error: (m: string) => push('error', m),
		dismiss(id: number) {
			update((list) => list.filter((t) => t.id !== id));
		}
	};
}

export const toasts = createToastStore();
