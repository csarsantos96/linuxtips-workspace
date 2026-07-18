// Fetch wrapper para o api-gateway do PICKStack.
//
// Características:
//   - lê PUBLIC_API_URL via env (SvelteKit injeta no client e no SSR);
//   - injeta `Authorization: Bearer <token>` quando há sessão;
//   - intercepta 401 e tenta refresh **uma única vez** antes de propagar erro;
//   - timeout configurável via AbortController;
//   - lança `ApiError` tipado com status code + payload.

import { browser } from '$app/environment';
import { PUBLIC_API_URL } from '$env/static/public';
import { auth } from '$lib/stores/auth';
import { get } from 'svelte/store';

const BASE_URL = (PUBLIC_API_URL ?? 'http://localhost:8080').replace(/\/+$/, '');
const DEFAULT_TIMEOUT_MS = 15_000;

export class ApiError extends Error {
	status: number;
	payload: unknown;
	constructor(status: number, message: string, payload?: unknown) {
		super(message);
		this.name = 'ApiError';
		this.status = status;
		this.payload = payload;
	}
}

export interface RequestOptions {
	method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
	body?: unknown;
	headers?: Record<string, string>;
	/** Se true, não tenta injetar Bearer token. Útil para /auth/login. */
	anonymous?: boolean;
	/** Se true, não tenta refresh em caso de 401. */
	noRetry?: boolean;
	timeoutMs?: number;
	/** fetch customizado — usado pelo SvelteKit no SSR para repassar cookies. */
	fetchFn?: typeof fetch;
	signal?: AbortSignal;
}

/* -------------------------------------------------------------------------- */
/* refresh-token flow                                                         */
/* -------------------------------------------------------------------------- */

let refreshInFlight: Promise<string | null> | null = null;

async function tryRefresh(fetchFn: typeof fetch): Promise<string | null> {
	if (!browser) return null;
	const refreshToken = localStorage.getItem('pickstack.refresh_token');
	if (!refreshToken) return null;

	if (!refreshInFlight) {
		refreshInFlight = (async () => {
			try {
				const res = await fetchFn(`${BASE_URL}/api/auth/refresh`, {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ refresh_token: refreshToken })
				});
				if (!res.ok) return null;
				const data = (await res.json()) as { token: string; refresh_token?: string };
				localStorage.setItem('pickstack.token', data.token);
				if (data.refresh_token) {
					localStorage.setItem('pickstack.refresh_token', data.refresh_token);
				}
				auth.update((s) => ({ ...s, token: data.token }));
				return data.token;
			} catch {
				return null;
			} finally {
				// Permite uma nova tentativa após a atual concluir.
				queueMicrotask(() => (refreshInFlight = null));
			}
		})();
	}

	return refreshInFlight;
}

/* -------------------------------------------------------------------------- */
/* core request                                                               */
/* -------------------------------------------------------------------------- */

export async function request<T = unknown>(
	path: string,
	opts: RequestOptions = {}
): Promise<T> {
	const {
		method = 'GET',
		body,
		headers = {},
		anonymous = false,
		noRetry = false,
		timeoutMs = DEFAULT_TIMEOUT_MS,
		fetchFn = fetch,
		signal
	} = opts;

	const url = path.startsWith('http') ? path : `${BASE_URL}${path}`;

	const finalHeaders: Record<string, string> = {
		accept: 'application/json',
		...headers
	};

	let payload: BodyInit | undefined;
	if (body !== undefined && body !== null) {
		if (body instanceof FormData) {
			payload = body;
		} else {
			finalHeaders['content-type'] = finalHeaders['content-type'] ?? 'application/json';
			payload = JSON.stringify(body);
		}
	}

	if (!anonymous) {
		const token = get(auth).token;
		if (token) finalHeaders['authorization'] = `Bearer ${token}`;
	}

	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	const compositeSignal = signal
		? anyAbortSignal(signal, controller.signal)
		: controller.signal;

	let res: Response;
	try {
		res = await fetchFn(url, {
			method,
			headers: finalHeaders,
			body: payload,
			signal: compositeSignal,
			credentials: 'omit'
		});
	} catch (err) {
		clearTimeout(timer);
		if ((err as Error).name === 'AbortError') {
			throw new ApiError(0, 'request timeout/aborted');
		}
		throw new ApiError(0, `network error: ${(err as Error).message}`);
	}
	clearTimeout(timer);

	// 401 → tenta refresh uma vez.
	if (res.status === 401 && !anonymous && !noRetry) {
		const newToken = await tryRefresh(fetchFn);
		if (newToken) {
			return request<T>(path, { ...opts, noRetry: true });
		}
		// Refresh falhou — invalida sessão.
		if (browser) {
			auth.clear();
			// Redireciono via location para não criar dependência cíclica em $app/navigation.
			if (!window.location.pathname.startsWith('/login')) {
				window.location.assign('/login');
			}
		}
	}

	const contentType = res.headers.get('content-type') ?? '';
	const isJson = contentType.includes('application/json');
	const data = isJson ? await res.json().catch(() => null) : await res.text();

	if (!res.ok) {
		const message =
			(isJson && data && typeof data === 'object' && 'message' in data && String((data as Record<string, unknown>).message)) ||
			res.statusText ||
			`HTTP ${res.status}`;
		throw new ApiError(res.status, message, data);
	}

	return data as T;
}

/* -------------------------------------------------------------------------- */
/* helpers                                                                    */
/* -------------------------------------------------------------------------- */

function anyAbortSignal(...signals: AbortSignal[]): AbortSignal {
	const ctrl = new AbortController();
	const onAbort = (s: AbortSignal) => () => ctrl.abort(s.reason);
	signals.forEach((s) => {
		if (s.aborted) ctrl.abort(s.reason);
		else s.addEventListener('abort', onAbort(s), { once: true });
	});
	return ctrl.signal;
}

/** Wraps a request and converts any error into `{ unavailable: true }`. */
export async function safeRequest<T>(
	path: string,
	opts: RequestOptions = {}
): Promise<{ ok: true; data: T } | { ok: false; unavailable: true; error: ApiError }> {
	try {
		const data = await request<T>(path, opts);
		return { ok: true, data };
	} catch (err) {
		const apiErr = err instanceof ApiError ? err : new ApiError(0, String(err));
		return { ok: false, unavailable: true, error: apiErr };
	}
}

export const api = {
	get: <T>(path: string, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
		request<T>(path, { ...opts, method: 'GET' }),
	post: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
		request<T>(path, { ...opts, method: 'POST', body }),
	put: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
		request<T>(path, { ...opts, method: 'PUT', body }),
	patch: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
		request<T>(path, { ...opts, method: 'PATCH', body }),
	delete: <T>(path: string, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
		request<T>(path, { ...opts, method: 'DELETE' })
};
