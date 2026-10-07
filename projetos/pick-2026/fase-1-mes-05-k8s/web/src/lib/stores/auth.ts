// Store global de autenticação. Persistência em localStorage (browser apenas).

import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import type { User } from '$lib/api/auth';

export interface AuthState {
	user: User | null;
	token: string | null;
	refreshToken: string | null;
	hydrated: boolean;
}

const TOKEN_KEY = 'pickstack.token';
const REFRESH_KEY = 'pickstack.refresh_token';
const USER_KEY = 'pickstack.user';

function loadInitial(): AuthState {
	if (!browser) {
		return { user: null, token: null, refreshToken: null, hydrated: false };
	}
	try {
		const token = localStorage.getItem(TOKEN_KEY);
		const refreshToken = localStorage.getItem(REFRESH_KEY);
		const userRaw = localStorage.getItem(USER_KEY);
		const user = userRaw ? (JSON.parse(userRaw) as User) : null;
		return { user, token, refreshToken, hydrated: true };
	} catch {
		return { user: null, token: null, refreshToken: null, hydrated: true };
	}
}

function createAuthStore() {
	const { subscribe, set, update } = writable<AuthState>(loadInitial());

	return {
		subscribe,
		update,

		set(state: AuthState) {
			set(state);
			persist(state);
		},

		login(payload: { user: User; token: string; refreshToken: string }) {
			const state: AuthState = {
				user: payload.user,
				token: payload.token,
				refreshToken: payload.refreshToken,
				hydrated: true
			};
			set(state);
			persist(state);
		},

		setUser(user: User | null) {
			update((s) => {
				const next = { ...s, user };
				persist(next);
				return next;
			});
		},

		clear() {
			set({ user: null, token: null, refreshToken: null, hydrated: true });
			if (browser) {
				localStorage.removeItem(TOKEN_KEY);
				localStorage.removeItem(REFRESH_KEY);
				localStorage.removeItem(USER_KEY);
			}
		}
	};
}

function persist(state: AuthState) {
	if (!browser) return;
	try {
		if (state.token) localStorage.setItem(TOKEN_KEY, state.token);
		else localStorage.removeItem(TOKEN_KEY);

		if (state.refreshToken) localStorage.setItem(REFRESH_KEY, state.refreshToken);
		else localStorage.removeItem(REFRESH_KEY);

		if (state.user) localStorage.setItem(USER_KEY, JSON.stringify(state.user));
		else localStorage.removeItem(USER_KEY);
	} catch {
		// localStorage indisponível (modo private etc.) — ignora silenciosamente.
	}
}

export const auth = createAuthStore();
