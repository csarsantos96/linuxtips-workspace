// Cliente do auth-svc (via api-gateway em /api/auth/*).
//
// Os endpoints do backend usam snake_case (tenant_id, refresh_token, etc.).
// Esta camada normaliza tudo para camelCase no domínio do frontend para que
// o resto do app (stores, components) trabalhe com tipos idiomáticos em TS.

import { api, request } from './client';

export interface User {
	id: string;
	email: string;
	name?: string | null;
	tenantId: string;
	createdAt?: string;
}

export interface AuthTokens {
	token: string;
	refresh_token: string;
	user: User;
}

interface RawUser {
	id: string;
	email: string;
	name?: string | null;
	tenant_id: string;
	created_at?: string;
}

interface RawAuthResponse {
	user: RawUser;
	token: string;
	refresh_token: string;
}

interface RawMeResponse {
	user: RawUser;
}

function normalizeUser(u: RawUser): User {
	return {
		id: u.id,
		email: u.email,
		name: u.name ?? null,
		tenantId: u.tenant_id,
		createdAt: u.created_at
	};
}

function normalizeAuth(res: RawAuthResponse): AuthTokens {
	return {
		token: res.token,
		refresh_token: res.refresh_token,
		user: normalizeUser(res.user)
	};
}

export const authApi = {
	async login(email: string, password: string): Promise<AuthTokens> {
		const raw = await request<RawAuthResponse>('/api/auth/login', {
			method: 'POST',
			body: { email, password },
			anonymous: true
		});
		return normalizeAuth(raw);
	},

	async signup(email: string, password: string, name: string): Promise<AuthTokens> {
		const raw = await request<RawAuthResponse>('/api/auth/signup', {
			method: 'POST',
			body: { email, password, name },
			anonymous: true
		});
		return normalizeAuth(raw);
	},

	async me(fetchFn?: typeof fetch): Promise<User> {
		const raw = await api.get<RawMeResponse>('/api/auth/me', { fetchFn });
		return normalizeUser(raw.user);
	},

	logout(refreshToken: string) {
		return api.post<void>('/api/auth/logout', { refresh_token: refreshToken });
	},

	changePassword(oldPassword: string, newPassword: string) {
		return api.post<void>('/api/auth/password', {
			old_password: oldPassword,
			new_password: newPassword
		});
	}
};
