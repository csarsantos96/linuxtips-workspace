// Cliente do cards-svc (spaced repetition SM-2).
//
// O backend devolve arrays "soltos" e snake_case. Adaptamos para `{ items: ... }`
// + camelCase para casar com a UI. Também consolidamos o nome do campo `ease`
// (UI) vs `easiness` (backend).

import { api } from './client';

export interface Deck {
	id: string;
	name: string;
	description?: string | null;
	isPublic: boolean;
	cardCount: number;
	dueCount: number;
	ownerId: string;
	createdAt: string;
}

export interface Card {
	id: string;
	deckId: string;
	front: string;
	back: string;
	tags: string[];
	ease: number;
	intervalDays: number;
	dueAt: string;
	createdAt: string;
}

export type ReviewQuality = 0 | 1 | 2 | 3 | 4 | 5;

interface RawDeck {
	id: string;
	name: string;
	description?: string | null;
	is_public?: boolean;
	isPublic?: boolean;
	owner_id?: string;
	ownerId?: string;
	tenant_id?: string;
	tenantId?: string;
	tags?: string[] | null;
	created_at?: string;
	createdAt?: string;
	card_count?: number;
	due_count?: number;
}

interface RawCard {
	id: string;
	deck_id?: string;
	deckId?: string;
	front: string;
	back: string;
	tags?: string[] | null;
	easiness: number;
	interval_days?: number;
	intervalDays?: number;
	repetitions: number;
	due_at?: string;
	dueAt?: string;
	created_at?: string;
	createdAt?: string;
}

function normalizeDeck(d: RawDeck): Deck {
	return {
		id: d.id,
		name: d.name,
		description: d.description ?? null,
		isPublic: !!(d.isPublic ?? d.is_public),
		cardCount: d.card_count ?? 0,
		dueCount: d.due_count ?? 0,
		ownerId: (d.ownerId ?? d.owner_id)!,
		createdAt: (d.createdAt ?? d.created_at)!
	};
}

function normalizeCard(c: RawCard): Card {
	return {
		id: c.id,
		deckId: (c.deckId ?? c.deck_id)!,
		front: c.front,
		back: c.back,
		tags: c.tags ?? [],
		ease: c.easiness,
		intervalDays: (c.intervalDays ?? c.interval_days)!,
		dueAt: (c.dueAt ?? c.due_at)!,
		createdAt: (c.createdAt ?? c.created_at)!
	};
}

export const cardsApi = {
	async listDecks() {
		const raw = await api.get<RawDeck[]>('/api/cards/decks');
		return { items: await Promise.all(raw.map((d) => cardsApi.getDeck(d.id))) };
	},
	async getDeck(id: string) {
		const raw = await api.get<RawDeck>(`/api/cards/decks/${id}`);
		return normalizeDeck(raw);
	},
	async createDeck(input: { name: string; description?: string; isPublic?: boolean }) {
		const raw = await api.post<RawDeck>('/api/cards/decks', {
			name: input.name,
			description: input.description,
			is_public: input.isPublic
		});
		return normalizeDeck(raw);
	},
	async updateDeck(
		id: string,
		input: Partial<{ name: string; description: string; isPublic: boolean }>
	) {
		const raw = await api.patch<RawDeck>(`/api/cards/decks/${id}`, {
			name: input.name,
			description: input.description,
			is_public: input.isPublic
		});
		return normalizeDeck(raw);
	},
	deleteDeck(id: string) {
		return api.delete<void>(`/api/cards/decks/${id}`);
	},

	async listCards(deckId: string) {
		const raw = await api.get<RawCard[]>(`/api/cards/decks/${deckId}/cards`);
		return { items: raw.map(normalizeCard) };
	},
	async createCard(deckId: string, input: { front: string; back: string; tags?: string[] }) {
		const raw = await api.post<RawCard>(`/api/cards/decks/${deckId}/cards`, input);
		return normalizeCard(raw);
	},
	async updateCard(
		_deckId: string,
		cardId: string,
		input: Partial<{ front: string; back: string; tags: string[] }>
	) {
		// Backend monta `PATCH /cards/:id` (não `/decks/:id/cards/:id`).
		const raw = await api.patch<RawCard>(`/api/cards/cards/${cardId}`, input);
		return normalizeCard(raw);
	},
	deleteCard(_deckId: string, cardId: string) {
		return api.delete<void>(`/api/cards/cards/${cardId}`);
	},

	async dueQueue(deckId: string, limit = 20) {
		// Backend: `/review/due?deck_id=&limit=` retorna array de cards.
		const raw = await api.get<RawCard[]>(
			`/api/cards/review/due?deck_id=${encodeURIComponent(deckId)}&limit=${limit}`
		);
		return { items: raw.map(normalizeCard) };
	},
	async review(cardId: string, quality: ReviewQuality) {
		// Backend devolve `{ card, next_due_at, interval_days }`. Extraímos o card.
		const raw = await api.post<{ card: RawCard; next_due_at: string; interval_days: number }>(
			`/api/cards/cards/${cardId}/review`,
			{ quality }
		);
		return normalizeCard(raw.card);
	}
};
