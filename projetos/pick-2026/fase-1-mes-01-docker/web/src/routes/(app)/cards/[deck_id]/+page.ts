import { cardsApi } from '$lib/api/cards';
import type { Card, Deck } from '$lib/api/cards';

async function safe<T>(p: Promise<T>): Promise<T | null> {
	try {
		return await p;
	} catch {
		return null;
	}
}

export const load = async ({ params }) => {
	const [deck, cards] = await Promise.all([
		safe(cardsApi.getDeck(params.deck_id)),
		safe(cardsApi.listCards(params.deck_id))
	]);

	return {
		deckId: params.deck_id,
		deck: (deck ?? null) as Deck | null,
		cards: (cards?.items ?? []) as Card[],
		unavailable: deck === null && cards === null
	};
};
