import { TestBed } from '@angular/core/testing';
import type {
	ApiPuzzle,
	TrainingAttempt,
	TrainingAttemptHistory,
} from '@chesspecker/api-definitions';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AttemptRow } from '@app/repository/definition/attempt-schema.interface';
import { TrainingLocalRepository } from '@app/repository/training-local.repository';
import { TrainingRepository } from '@app/repository/training.repository';
import { SessionStore } from '@app/store/session.store';
import { PuzzleCacheUseCase } from '@app/use-case/puzzle-cache.use-case';
import { TrainingRestoreUseCase } from '@app/use-case/training-restore.use-case';

const TRAINING = 'training-1';

function apiPuzzle(lichessId: string): ApiPuzzle {
	return {
		uuid: `puzzle-${lichessId}`,
		lichessId,
		fen: '6k1/5ppp/8/8/8/8/8/R5K1 b - - 0 1',
		moves: ['g8h8', 'a1a8'],
		rating: 1500,
		themes: ['backRankMate'],
	};
}

function attempt(
	over: Omit<Partial<TrainingAttempt>, 'cycleItemUuid'> & {
		cycleItemUuid?: string | undefined;
	} = {},
): TrainingAttempt {
	const cycleItemUuid = 'cycleItemUuid' in over ? over.cycleItemUuid : 'item-1';
	const { cycleItemUuid: _dropped, ...rest } = over;

	return {
		uuid: 'server-attempt-1',
		kind: 'cycle',
		puzzle: apiPuzzle('AAA11'),
		...(undefined === cycleItemUuid ? {} : { cycleItemUuid }),
		position: 6,
		durationMs: 4200,
		solved: true,
		closure: 'found',
		hintUsed: false,
		mistakeCount: 1,
		record: ['g8h8', 'a1a8'],
		explorations: [],
		createdAt: '2026-08-11T10:00:00.000Z',
		updatedAt: '2026-08-11T10:00:30.000Z',
		...rest,
	};
}

function page(over: Partial<TrainingAttemptHistory> = {}): TrainingAttemptHistory {
	return { attempts: [attempt()], cursor: 'cursor-1', hasMore: false, ...over };
}

function configure(
	options: { stored?: AttemptRow; cursor?: string; authenticated?: boolean } = {},
) {
	const inserted: { store: string; row: unknown }[] = [];
	const listAttempts = vi.fn<(uuid: string, query: { since?: string }) => Promise<unknown>>();
	const save = vi.fn().mockResolvedValue(undefined);

	const repository = {
		find: vi
			.fn()
			.mockResolvedValue(
				undefined === options.cursor
					? undefined
					: { trainingUuid: TRAINING, cursor: options.cursor, updatedAt: new Date() },
			),
		findByIndex: vi.fn().mockResolvedValue(options.stored),
		insert: vi.fn((store: string, row: unknown) => {
			inserted.push({ store, row });

			return Promise.resolve(row);
		}),
	};

	TestBed.resetTestingModule();
	TestBed.configureTestingModule({
		providers: [
			{ provide: SessionStore, useValue: { isAuthenticated: () => options.authenticated ?? true } },
			{ provide: TrainingRepository, useValue: { listAttempts } },
			{ provide: TrainingLocalRepository, useValue: repository },
			{ provide: PuzzleCacheUseCase, useValue: { save } },
		],
	});

	return {
		listAttempts,
		save,
		repository,
		rows: () => inserted.filter((entry) => 'attempt' === entry.store).map((entry) => entry.row),
		cursors: () => inserted.filter((entry) => 'attemptCursor' === entry.store).map((e) => e.row),
		useCase: TestBed.inject(TrainingRestoreUseCase),
	};
}

describe('TrainingRestoreUseCase', () => {
	beforeEach(() => {
		TestBed.resetTestingModule();
	});

	it('asks for nothing while there is no session', async () => {
		const { useCase, listAttempts } = configure({ authenticated: false });

		await useCase.execute(TRAINING);

		expect(listAttempts).not.toHaveBeenCalled();
	});

	it('writes the missing attempt under the slot it belongs to', async () => {
		const { useCase, listAttempts, save, rows } = configure();

		listAttempts.mockResolvedValue(page());

		await useCase.execute(TRAINING);

		expect(save).toHaveBeenCalledWith([apiPuzzle('AAA11')]);
		expect(rows()).toHaveLength(1);
		expect(rows()[0]).toMatchObject({
			uuid: 'server-attempt-1',
			trainingUuid: TRAINING,
			slotId: 'item-1',
			cycleItemUuid: 'item-1',
			puzzleUuid: 'puzzle-AAA11',
			lichessId: 'AAA11',
			position: 6,
			solved: true,
			closure: 'found',
			record: ['g8h8', 'a1a8'],
		});
		expect((rows()[0] as AttemptRow).syncedAt).toBeInstanceOf(Date);
	});

	it('names a calibration slot by its round and its exercise', async () => {
		const { useCase, listAttempts, rows } = configure();

		listAttempts.mockResolvedValue(
			page({
				attempts: [
					attempt({ kind: 'calibration', roundUuid: 'round-1', cycleItemUuid: undefined }),
				],
			}),
		);

		await useCase.execute(TRAINING);

		expect(rows()[0]).toMatchObject({ slotId: `${TRAINING}/round-1/puzzle-AAA11` });
	});

	it('leaves alone the slot this device already has', async () => {
		const { useCase, listAttempts, rows } = configure({
			stored: { uuid: 'local-attempt-1', slotId: 'item-1', position: 6 } as AttemptRow,
		});

		listAttempts.mockResolvedValue(page());

		await useCase.execute(TRAINING);

		expect(rows()).toStrictEqual([]);
	});

	it('fills in the place of a row that was written before it travelled', async () => {
		const { useCase, listAttempts, rows } = configure({
			stored: { uuid: 'local-attempt-1', slotId: 'item-1', solved: false } as AttemptRow,
		});

		listAttempts.mockResolvedValue(page());

		await useCase.execute(TRAINING);

		expect(rows()).toStrictEqual([
			{ uuid: 'local-attempt-1', slotId: 'item-1', solved: false, position: 6 },
		]);
	});

	it('starts from the cursor it kept, and keeps the one that comes back', async () => {
		const { useCase, listAttempts, cursors } = configure({ cursor: 'cursor-0' });

		listAttempts.mockResolvedValue(page());

		await useCase.execute(TRAINING);

		expect(listAttempts).toHaveBeenCalledWith(TRAINING, { since: 'cursor-0' });
		expect(cursors()).toStrictEqual([
			expect.objectContaining({ trainingUuid: TRAINING, cursor: 'cursor-1' }),
		]);
	});

	it('keeps asking while the server says there is more', async () => {
		const { useCase, listAttempts, rows } = configure();

		listAttempts
			.mockResolvedValueOnce(page({ cursor: 'cursor-1', hasMore: true }))
			.mockResolvedValueOnce(
				page({
					attempts: [attempt({ uuid: 'server-attempt-2', cycleItemUuid: 'item-2' })],
					cursor: 'cursor-2',
				}),
			);

		await useCase.execute(TRAINING);

		expect(listAttempts).toHaveBeenNthCalledWith(2, TRAINING, { since: 'cursor-1' });
		expect(rows()).toHaveLength(2);
	});

	it('says nothing when the server cannot be reached', async () => {
		const { useCase, listAttempts, rows } = configure();

		listAttempts.mockRejectedValue(new Error('offline'));

		await expect(useCase.execute(TRAINING)).resolves.toBeUndefined();
		expect(rows()).toStrictEqual([]);
	});
});
