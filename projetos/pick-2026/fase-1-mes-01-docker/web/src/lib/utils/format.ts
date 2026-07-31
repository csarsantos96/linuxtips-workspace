// Funções utilitárias de formatação compartilhadas por toda a UI.

const dtfDate = new Intl.DateTimeFormat('pt-BR', {
	year: 'numeric',
	month: '2-digit',
	day: '2-digit'
});

const dtfDateTime = new Intl.DateTimeFormat('pt-BR', {
	year: 'numeric',
	month: '2-digit',
	day: '2-digit',
	hour: '2-digit',
	minute: '2-digit'
});

export function formatDate(value: string | Date | undefined | null): string {
	if (!value) return '—';
	const d = typeof value === 'string' ? new Date(value) : value;
	if (Number.isNaN(d.getTime())) return '—';
	return dtfDate.format(d);
}

export function formatDateTime(value: string | Date | undefined | null): string {
	if (!value) return '—';
	const d = typeof value === 'string' ? new Date(value) : value;
	if (Number.isNaN(d.getTime())) return '—';
	return dtfDateTime.format(d);
}

export function formatDurationSeconds(secs: number | null | undefined): string {
	if (secs == null) return '—';
	const s = Math.max(0, Math.floor(secs));
	const h = Math.floor(s / 3600);
	const m = Math.floor((s % 3600) / 60);
	const r = s % 60;
	if (h > 0) return `${h}h ${pad(m)}m`;
	if (m > 0) return `${m}m ${pad(r)}s`;
	return `${r}s`;
}

export function formatCountdown(secs: number): string {
	const s = Math.max(0, Math.floor(secs));
	const m = Math.floor(s / 60);
	const r = s % 60;
	return `${pad(m)}:${pad(r)}`;
}

export function toIsoDate(d: Date): string {
	const y = d.getFullYear();
	const m = pad(d.getMonth() + 1);
	const day = pad(d.getDate());
	return `${y}-${m}-${day}`;
}

export function relativeFromNow(value: string | Date | null | undefined): string {
	if (!value) return '—';
	const d = typeof value === 'string' ? new Date(value) : value;
	if (Number.isNaN(d.getTime())) return '—';
	const diffMs = Date.now() - d.getTime();
	const sec = Math.round(diffMs / 1000);
	if (sec < 60) return `${sec}s atrás`;
	const min = Math.round(sec / 60);
	if (min < 60) return `${min} min atrás`;
	const hr = Math.round(min / 60);
	if (hr < 24) return `${hr}h atrás`;
	const day = Math.round(hr / 24);
	if (day < 30) return `${day}d atrás`;
	return formatDate(d);
}

function pad(n: number): string {
	return n.toString().padStart(2, '0');
}

export function pluralize(n: number, singular: string, plural: string): string {
	return n === 1 ? `${n} ${singular}` : `${n} ${plural}`;
}
