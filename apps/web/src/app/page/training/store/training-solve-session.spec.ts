import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { patchState } from '@ngrx/signals';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_MISTAKE_POLICY } from '@app/definition/mistake-policy.type';
import { DEFAULT_MOVE_SPEED } from '@app/definition/move-speed.type';
import { ApiPuzzle, Training, TrainingCycleItem } from '@app/definition/training.interface';
import { PuzzleStore } from '@app/page/puzzle/store/puzzle/puzzle.store';
import { PuzzleLibraryStore } from '@app/page/puzzle/store/puzzle-library/puzzle-library.store';
import { TrainingRunStore } from '@app/page/training/store/training-run.store';
import { TrainingSolveSession } from '@app/page/training/store/training-solve-session';
import { TrainingRunRepository } from '@app/repository/training-run.repository';
import { BoardPreferenceService } from '@app/service/board-preference.service';
import { MistakePolicyService } from '@app/service/mistake-policy.service';
import { SoundService } from '@app/service/sound.service';
import { TrainingStore } from '@app/store/training.store';

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

function configure(repository: ReturnType<typeof createRepository>) {
	TestBed.configureTestingModule({
		providers: [
			PuzzleLibraryStore,
			PuzzleStore,
			TrainingRunStore,
			TrainingSolveSession,
			{ provide: TrainingRunRepository, useValue: repository },
			{ provide: TrainingStore, useValue: { active: signal(TRAINING), load: vi.fn() } },
			{ provide: MistakePolicyService, useValue: { policy: signal(DEFAULT_MISTAKE_POLICY) } },
			{ provide: BoardPreferenceService, useValue: { moveSpeed: signal(DEFAULT_MOVE_SPEED) } },
			{ provide: SoundService, useValue: { playMove: (): void => undefined } },
		],
	});

	return {
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
}

/** What the board does when the player finds the move, without playing the chess. */
async function settleSolved(board: PuzzleStore): Promise<void> {
	patchState(board, { result: 'solved' });
	TestBed.tick();
	await vi.advanceTimersByTimeAsync(0);
}

describe('TrainingSolveSession', () => {
	beforeEach(() => {
		vi.useFakeTimers();
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

		expect(repository.submitCycleAttempt).toHaveBeenCalledWith('training-1', {
			cycleItemUuid: 'item-1',
			durationMs: OPENING + 3000 + 2000,
			solved: true,
		});
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
});
