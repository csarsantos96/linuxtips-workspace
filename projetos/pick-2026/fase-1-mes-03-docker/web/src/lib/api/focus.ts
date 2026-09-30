// Cliente do focus-svc.
//
// O backend usa snake_case e mistura "minutos" e "segundos" em alguns endpoints.
// Aqui normalizamos tudo para o domínio do frontend (camelCase + segundos).

import { api } from './client';

export type SessionType = 'pomodoro' | 'deep' | 'custom';
export type SessionStatus = 'active' | 'completed' | 'abandoned';

export interface StudySession {
	id: string;
	type: SessionType;
	plannedDurationS: number;
	startedAt: string;
	endedAt?: string | null;
	actualDurationS?: number | null;
	status: SessionStatus;
	note?: string | null;
}

export interface HeatmapDay {
	date: string; // YYYY-MM-DD
	count: number;
	totalSeconds: number;
}

export interface StreakInfo {
	current: number;
	longest: number;
	lastActiveDate?: string | null;
}

// --- shapes cruas do backend ------------------------------------------------

interface RawSession {
	id: string;
	type: string;
	planned_duration_s: number;
	started_at: string;
	ended_at?: string | null;
	actual_duration_s?: number | null;
	status: string;
	note?: string | null;
}

interface RawHeatmapDay {
	date: string;
	total_minutes: number;
	session_count: number;
}

interface RawStreak {
	current_days: number;
	longest_days: number;
	last_session_at: string | null;
}

function normalizeSession(r: RawSession): StudySession {
	return {
		id: r.id,
		type: r.type as SessionType,
		plannedDurationS: r.planned_duration_s,
		startedAt: r.started_at,
		endedAt: r.ended_at ?? null,
		actualDurationS: r.actual_duration_s ?? null,
		status: r.status as SessionStatus,
		note: r.note ?? null
	};
}

export const focusApi = {
	async list(params?: { from?: string; to?: string; limit?: number; offset?: number }) {
		const qs = toQuery(params);
		const raw = await api.get<{ items: RawSession[]; total: number }>(
			`/api/focus/sessions${qs}`
		);
		return { items: raw.items.map(normalizeSession), total: raw.total };
	},

	async today() {
		const raw = await api.get<{ items: RawSession[] }>('/api/focus/sessions/today');
		return { items: raw.items.map(normalizeSession) };
	},

	async start(input: { type: SessionType; plannedDurationS: number; note?: string }) {
		// Backend espera duration em minutos no /sessions/start.
		const raw = await api.post<RawSession>('/api/focus/sessions/start', {
			type: input.type,
			duration_min: Math.max(1, Math.round(input.plannedDurationS / 60)),
			note: input.note
		});
		return normalizeSession(raw);
	},

	async end(id: string, input?: { note?: string }) {
		const raw = await api.post<RawSession>(`/api/focus/sessions/${id}/end`, input ?? {});
		return normalizeSession(raw);
	},

	async abandon(id: string) {
		const raw = await api.post<RawSession>(`/api/focus/sessions/${id}/abandon`, {});
		return normalizeSession(raw);
	},

	async heatmap(days = 90) {
		// Backend devolve array; adaptamos para `{ days: HeatmapDay[] }`.
		const raw = await api.get<RawHeatmapDay[]>(`/api/focus/stats/heatmap?days=${days}`);
		return {
			days: raw.map((d) => ({
				date: d.date,
				count: d.session_count,
				totalSeconds: d.total_minutes * 60
			}))
		};
	},

	async streak(): Promise<StreakInfo> {
		const raw = await api.get<RawStreak>('/api/focus/stats/streak');
		return {
			current: raw.current_days,
			longest: raw.longest_days,
			lastActiveDate: raw.last_session_at
				? new Date(raw.last_session_at).toISOString().slice(0, 10)
				: null
		};
	}
};

function toQuery(p?: Record<string, unknown>): string {
	if (!p) return '';
	const entries = Object.entries(p).filter(([, v]) => v !== undefined && v !== null);
	if (entries.length === 0) return '';
	return '?' + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&');
}
