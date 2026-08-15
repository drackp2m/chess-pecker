import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { ApiPuzzle, Training, TrainingCycleItem } from '@chesspecker/api-definitions';
import { patchState } from '@ngrx/signals';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_MOVE_SPEED } from '@app/definition/move-speed.type';
import { HINT_DELAY_MS } from '@app/definition/puzzle.type';
import { PuzzleStore } from '@app/page/puzzle/store/puzzle/puzzle.store';
import { PuzzleLibraryStore } from '@app/page/puzzle/store/puzzle-library/puzzle-library.store';
import { TrainingRunStore } from '@app/page/training/store/training-run.store';
import { TrainingSolveSession } from '@app/page/training/store/training-solve-session';
import { AttemptRepository } from '@app/repository/attempt.repository';
import { AttemptRow } from '@app/repository/definition/attempt-schema.interface';
import { TrainingRunRepository } from '@app/repository/training-run.repository';
import { BoardPreferenceService } from '@app/service/board-preference.service';
import { TrainingStore } from '@app/store/training.store';
import { SOLVE_FLUSH_INTERVAL_MS } from '@app/util/solve-timer';

/** Black walks into the corner, White mates on the back rank: one move for the player. */
const BACK_RANK_MATE: ApiPuzzle = {
	uuid: 'puzzle-1',
	lichessId: 'AAA11',
	fen: '6k1/5ppp/8/8/8/8/8/R5K1 b - - 0 1',
	moves: ['g8h8', 'a1a8'],
	rating: 1500,
	themes: ['backRankMate'],
};

const OTHER_MATE: ApiPuzzle = { ...BACK_RANK_MATE, uuid: 'puzzle-2', lichessId: 'BBB22' };

const TRAINING: Training = {
	uuid: 'training-1',
	status: 'running',
	createdAt: '2026-08-01T00:00:00.000Z',
	updatedAt: '2026-08-01T00:00:00.000Z',
};

/** Long enough for both beats of the opponent's opening move: it lights up, then moves. */
const OPENING = 1500;

const OPENED_AT = '2026-08-03T10:00:00.000Z';

const STORED_DRAFT: AttemptRow = {
	uuid: 'attempt-draft-1',
	trainingUuid: 'training-1',
	kind: 'cycle',
	slotId: 'item-1',
	cycleItemUuid: 'item-1',
	puzzleUuid: 'puzzle-1',
	lichessId: 'AAA11',
	durationMs: 12_000,
	record: ['g8h8', 'a1a2', -1],
	explorations: [],
	orientation: 'white',
	closure: 'open',
	hintUsed: true,
	mistakeCount: 1,
	createdAt: new Date('2026-08-03T09:00:00.000Z'),
	updatedAt: new Date('2026-08-03T09:00:12.000Z'),
};

function toItem(puzzle: ApiPuzzle, uuid: string, position: number): TrainingCycleItem {
	return { uuid, position, trainingPuzzle: { uuid: `tp-${uuid}`, puzzle } };
}

function createRepository(cycleFinished = false) {
	return {
		getNextItem: vi
			.fn()
			.mockResolvedValueOnce(toItem(BACK_RANK_MATE, 'item-1', 0))
			.mockResolvedValue(toItem(OTHER_MATE, 'item-2', 1)),
		submitCycleAttempt: vi.fn().mockResolvedValue({
			attempt: { uuid: 'attempt-1', durationMs: 0, solved: true },
			cycleFinished,
		}),
	};
}

/** Stands in for IndexedDB, and survives a reset so a reload can be replayed against it. */
function createAttemptStorage() {
	const rows = new Map<string, AttemptRow>();

	return {
		rows,
		insert: vi.fn((_storeName: 'attempt', row: AttemptRow) => {
			rows.set(row.uuid, row);

			return Promise.resolve(row);
		}),
		findByIndex: vi.fn((_storeName: 'attempt', _indexName: 'slotId', slotId: string) =>
			Promise.resolve([...rows.values()].find((row) => row.slotId === slotId)),
		),
	};
}

function configure(
	repository: ReturnType<typeof createRepository>,
	attempts = createAttemptStorage(),
) {
	TestBed.configureTestingModule({
		providers: [
			PuzzleLibraryStore,
			PuzzleStore,
			TrainingRunStore,
			TrainingSolveSession,
			{ provide: AttemptRepository, useValue: attempts },
			{ provide: TrainingRunRepository, useValue: repository },
			{ provide: TrainingStore, useValue: { active: signal(TRAINING), load: vi.fn() } },
			{ provide: BoardPreferenceService, useValue: { moveSpeed: signal(DEFAULT_MOVE_SPEED) } },
		],
	});

	return {
		attempts,
		session: TestBed.inject(TrainingSolveSession),
		run: TestBed.inject(TrainingRunStore),
		board: TestBed.inject(PuzzleStore),
	};
}

/** Enters the page: opens the run, lets the effects land and the opponent reply. */
async function enter(session: TrainingSolveSession): Promise<void> {
	await session.open();
	TestBed.tick();
	vi.advanceTimersByTime(OPENING);
	await vi.advanceTimersByTimeAsync(0);
}

function onlyRow(attempts: ReturnType<typeof createAttemptStorage>): AttemptRow | undefined {
	return [...attempts.rows.values()][0];
}

/** What the board does when the player finds the move, without playing the chess. */
async function settleSolved(board: PuzzleStore): Promise<void> {
	patchState(board, { result: 'solved', closure: 'found' });
	TestBed.tick();
	await vi.advanceTimersByTimeAsync(0);
}

/** The same for a miss, which grades the attempt without ending the exercise. */
async function settleFailed(board: PuzzleStore): Promise<void> {
	patchState(board, { result: 'failed' });
	TestBed.tick();
	await vi.advanceTimersByTimeAsync(0);
}

describe('TrainingSolveSession', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date(OPENED_AT));
	});

	afterEach(() => {
		vi.useRealTimers();
		TestBed.resetTestingModule();
	});

	it('opens the exercise the run deals onto the board', async () => {
		const { session, run, board } = configure(createRepository());

		await enter(session);

		expect(run.current()?.puzzle.uuid).toBe('puzzle-1');
		expect(board.puzzle()?.id).toBe('AAA11');
	});

	it('keeps the exercise and its board when the section is left and reopened', async () => {
		const repository = createRepository();
		const { session, run, board } = configure(repository);

		await enter(session);

		const cursor = board.cursor();

		session.pause();
		await enter(session);

		expect(repository.getNextItem).toHaveBeenCalledTimes(1);
		expect(run.current()?.puzzle.uuid).toBe('puzzle-1');
		expect(board.puzzle()?.id).toBe('AAA11');
		expect(board.cursor()).toBe(cursor);
	});

	/**
	 * The board is drawn from scratch on the way in, so the beat it was left mid-way
	 * through would otherwise be run again as if it had just been asked for.
	 */
	it('plays the move the line was left standing on when the exercise is opened again', async () => {
		const { session, board } = configure(createRepository());

		await enter(session);

		const settled = board.transition();

		session.pause();
		await session.open();

		expect(board.transition()).toBeUndefined();

		vi.advanceTimersByTime(OPENING);

		const replayed = board.transition();

		expect(board.cursor()).toBe(1);
		expect(replayed?.kind).toBe('forward');
		// A slide the board has already run is one no piece will run again, so the move
		// coming back comes back under a beat of its own.
		expect(replayed?.stages[0]?.tick).toBeGreaterThan(settled?.stages[0]?.tick ?? 0);
	});

	it('records only the time the exercise spent on screen', async () => {
		const repository = createRepository();
		const { session, board } = configure(repository);

		await enter(session);
		vi.advanceTimersByTime(3000);

		session.pause();
		vi.advanceTimersByTime(60_000);
		session.resume();

		vi.advanceTimersByTime(2000);
		await settleSolved(board);

		expect(repository.submitCycleAttempt).toHaveBeenCalledWith(
			'training-1',
			expect.objectContaining({
				cycleItemUuid: 'item-1',
				durationMs: OPENING + 3000 + 2000,
				solved: true,
			}),
		);
	});

	/**
	 * The wait behind the hint is the same measure as the duration above, so the board's
	 * clock is paused and picked up by the very calls that pause and pick up the attempt's.
	 */
	it('keeps the hint on the clock the duration is measured by', async () => {
		const { session, board } = configure(createRepository());

		await enter(session);
		vi.advanceTimersByTime(HINT_DELAY_MS - OPENING - 1000);

		session.pause();
		vi.advanceTimersByTime(60_000);
		session.resume();

		expect(board.canUseHint()).toBe(false);

		vi.advanceTimersByTime(1000);

		expect(board.canUseHint()).toBe(true);
	});

	it('stamps the attempt with when the exercise opened and when it settled', async () => {
		const repository = createRepository();
		const { session, board } = configure(repository);

		await enter(session);
		await settleSolved(board);

		expect(repository.submitCycleAttempt).toHaveBeenCalledWith(
			'training-1',
			expect.objectContaining({
				createdAt: OPENED_AT,
				updatedAt: '2026-08-03T10:00:01.500Z',
			}),
		);
	});

	it('carries the clock across a round trip instead of restarting it', async () => {
		const repository = createRepository();
		const { session, board } = configure(repository);

		await enter(session);
		vi.advanceTimersByTime(3000);

		session.pause();
		await enter(session);

		vi.advanceTimersByTime(2000);
		await settleSolved(board);

		expect(repository.submitCycleAttempt).toHaveBeenCalledWith(
			'training-1',
			expect.objectContaining({ durationMs: OPENING + 3000 + OPENING + 2000 }),
		);
	});

	it('submits the attempt once, however many times the page is reopened', async () => {
		const repository = createRepository();
		const { session, board } = configure(repository);

		await enter(session);
		await settleSolved(board);

		session.pause();
		await enter(session);
		await settleSolved(board);

		expect(repository.submitCycleAttempt).toHaveBeenCalledTimes(1);
	});

	it('starts a fresh run once the previous one is done', async () => {
		const repository = createRepository(true);
		const { session, run, board } = configure(repository);

		await enter(session);
		await settleSolved(board);

		expect(run.isDone()).toBe(true);

		session.pause();
		await enter(session);

		expect(repository.getNextItem).toHaveBeenCalledTimes(2);
		expect(run.current()?.puzzle.uuid).toBe('puzzle-2');
	});

	it('writes a draft attempt row as soon as the exercise is on the board', async () => {
		const { session, attempts } = configure(createRepository());

		await enter(session);

		expect(onlyRow(attempts)).toMatchObject({
			trainingUuid: 'training-1',
			kind: 'cycle',
			slotId: 'item-1',
			cycleItemUuid: 'item-1',
			lichessId: 'AAA11',
		});
		expect(onlyRow(attempts)?.solved).toBeUndefined();
	});

	it('keeps the clock flowing into the row with nothing being played', async () => {
		const { session, attempts } = configure(createRepository());

		await enter(session);

		expect(onlyRow(attempts)?.durationMs).toBe(OPENING);

		await vi.advanceTimersByTimeAsync(SOLVE_FLUSH_INTERVAL_MS * 2);

		expect(onlyRow(attempts)?.durationMs).toBe(SOLVE_FLUSH_INTERVAL_MS * 2);
	});

	it('picks a stored draft back up instead of restarting the clock', async () => {
		const { session, attempts } = configure(createRepository());

		await enter(session);
		vi.advanceTimersByTime(3000);
		session.pause();
		await vi.advanceTimersByTimeAsync(0);

		TestBed.resetTestingModule();

		const repository = createRepository();
		const reloaded = configure(repository, attempts);

		await enter(reloaded.session);
		vi.advanceTimersByTime(2000);
		await settleSolved(reloaded.board);

		expect(repository.submitCycleAttempt).toHaveBeenCalledWith(
			'training-1',
			expect.objectContaining({ durationMs: OPENING + 3000 + OPENING + 2000 }),
		);
		expect(attempts.rows.size).toBe(1);
	});

	/**
	 * The regression the whole restore is for: the board a reload draws is the stored one,
	 * so what the flush writes back is what it read. Only the clock moves on.
	 */
	it('writes the stored record straight back while nothing is played on the board', async () => {
		const attempts = createAttemptStorage();

		attempts.rows.set(STORED_DRAFT.uuid, STORED_DRAFT);

		const { session } = configure(createRepository(), attempts);

		await enter(session);
		await vi.advanceTimersByTimeAsync(SOLVE_FLUSH_INTERVAL_MS * 2);

		session.pause();
		await vi.advanceTimersByTimeAsync(0);

		expect(attempts.rows.size).toBe(1);
		expect(onlyRow(attempts)).toMatchObject({
			uuid: STORED_DRAFT.uuid,
			record: STORED_DRAFT.record,
			explorations: [],
			hintUsed: true,
			mistakeCount: 1,
			closure: 'open',
		});
	});

	it('puts the stored board back, cursor and all, before anything is written', async () => {
		const attempts = createAttemptStorage();

		attempts.rows.set(STORED_DRAFT.uuid, STORED_DRAFT);

		const { session, board } = configure(createRepository(), attempts);

		await enter(session);

		// `g8h8`, then the miss `a1a2` and the step back off it: two plies on the board with
		// the cursor standing behind the second.
		expect(board.line()).toHaveLength(2);
		expect(board.cursor()).toBe(1);
		expect(board.mistakeCount()).toBe(1);
		expect(board.hintUsed()).toBe(true);
	});

	it('goes on writing the stored row once the player plays on the board again', async () => {
		const attempts = createAttemptStorage();

		attempts.rows.set(STORED_DRAFT.uuid, STORED_DRAFT);

		const { session, board } = configure(createRepository(), attempts);

		await enter(session);

		board.selectSquare('a1');
		board.selectSquare('a8');
		TestBed.tick();
		await vi.advanceTimersByTimeAsync(0);

		expect(attempts.rows.size).toBe(1);
		expect(onlyRow(attempts)).toMatchObject({
			uuid: STORED_DRAFT.uuid,
			record: [...STORED_DRAFT.record, 'a1a8'],
			mistakeCount: 1,
		});
	});

	it('holds the attempt back while the miss is still being worked on', async () => {
		const repository = createRepository();
		const { session, board } = configure(repository);

		await enter(session);
		await settleFailed(board);
		vi.advanceTimersByTime(4000);

		// The verdict is sealed, the exercise is not: nothing has been sent, and the
		// clock is still running on it.
		expect(repository.submitCycleAttempt).not.toHaveBeenCalled();

		patchState(board, { closure: 'revealed' });
		TestBed.tick();
		await vi.advanceTimersByTimeAsync(0);

		expect(repository.submitCycleAttempt).toHaveBeenCalledWith(
			'training-1',
			expect.objectContaining({ solved: false, durationMs: OPENING + 4000 }),
		);
	});

	it('closes the draft with the verdict once the exercise closes', async () => {
		const { session, board, attempts } = configure(createRepository());

		await enter(session);
		await settleSolved(board);
		await vi.advanceTimersByTimeAsync(0);

		expect(onlyRow(attempts)?.solved).toBe(true);
		expect(onlyRow(attempts)?.startedAt).toBeUndefined();
	});
});
