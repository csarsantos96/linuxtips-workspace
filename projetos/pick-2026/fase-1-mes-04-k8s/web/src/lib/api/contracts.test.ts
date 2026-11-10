import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('./client', () => ({ api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } }));
import { api } from './client';
import { focusApi } from './focus';
import { cardsApi } from './cards';
import { trilhaApi } from './trilha';

beforeEach(() => {
	vi.resetAllMocks();
});
describe('contratos reais dos serviços', () => {
	it('preserva duração e início do Focus retornado pelo Drizzle', async () => {
		vi.mocked(api.post).mockResolvedValue({
			id: 's',
			plannedDurationS: 60,
			startedAt: '2026-10-21',
			status: 'active',
			type: 'custom'
		});
		expect(await focusApi.start({ type: 'custom', plannedDurationS: 60 })).toMatchObject({
			plannedDurationS: 60,
			startedAt: '2026-10-21'
		});
	});
	it('continua aceitando a consulta SQL snake_case de hoje', async () => {
		vi.mocked(api.get).mockResolvedValue({
			items: [{ id: 's', planned_duration_s: 60, started_at: '2026-10-21', status: 'completed' }]
		});
		expect((await focusApi.today()).items[0]).toMatchObject({
			plannedDurationS: 60,
			startedAt: '2026-10-21'
		});
	});
	it('preserva data e intervalo de revisão dos cards', async () => {
		vi.mocked(api.post).mockResolvedValue({
			card: { id: 'c', deckId: 'd', intervalDays: 1, dueAt: '2026-10-22', createdAt: '2026-10-21' }
		});
		expect(await cardsApi.review('c', 5)).toMatchObject({
			deckId: 'd',
			intervalDays: 1,
			dueAt: '2026-10-22'
		});
	});
	it('carrega contagens reais do deck', async () => {
		vi.mocked(api.get)
			.mockResolvedValueOnce([{ id: 'd' }])
			.mockResolvedValueOnce({ id: 'd', card_count: 2, due_count: 1 });
		expect((await cardsApi.listDecks()).items[0]).toMatchObject({ cardCount: 2, dueCount: 1 });
	});
	it('resolve dependências externas para UUIDs e conta todos os níveis da trilha', async () => {
		vi.mocked(api.get).mockResolvedValue({
			id: 'r',
			name: 'Trilha',
			nodes: [
				{
					id: 'uuid1',
					externalId: 'a',
					roadmapId: 'r',
					title: 'A',
					orderIndex: 0,
					progress: { status: 'done' }
				},
				{
					id: 'uuid2',
					externalId: 'b',
					roadmapId: 'r',
					title: 'B',
					dependsOn: ['a'],
					orderIndex: 1
				},
				{
					id: 'uuid3',
					externalId: 'c',
					roadmapId: 'r',
					title: 'C',
					dependsOn: ['b'],
					orderIndex: 2
				}
			]
		});
		const result = await trilhaApi.get('r');
		expect(result.roadmap).toMatchObject({ nodeCount: 3, doneCount: 1 });
		expect(result.nodes.map((n) => n.parentId)).toEqual([null, 'uuid1', 'uuid2']);
	});
});
