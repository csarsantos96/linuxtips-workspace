import { cardsApi } from '$lib/api/cards';
import type { Deck } from '$lib/api/cards';

async function safe<T>(p: Promise<T>): Promise<T | null> {
	try {
		return await p;
	} catch {
		return null;
	}
}

export const load = async () => {
	const res = await safe(cardsApi.listDecks());
	return {
		decks: (res?.items ?? []) as Deck[],
		unavailable: res === null
	};
};
