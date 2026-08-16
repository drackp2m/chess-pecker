import { TestBed } from '@angular/core/testing';
import type { ApiPuzzle } from '@chesspecker/api-definitions';
import { patchState } from '@ngrx/signals';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TrainingReviewStore } from '@app/page/training/store/training-review.store';
import { TrainingRunSlot } from '@app/page/training/store/training-run-state';
import { TrainingRunStore } from '@app/page/training/store/training-run.store';
import { AttemptRow } from '@app/repository/definition/attempt-schema.interface';
import { TrainingRunRepository } from '@app/repository/training-run.repository';
import { PuzzleCacheUseCase } from '@app/use-case/puzzle-cache.use-case';
import { SolvedAttempt, TrainingHistoryUseCase } from '@app/use-case/training-history.use-case';

function apiPuzzle(uuid: string, lichessId: string): ApiPuzzle {
	return {
		uuid,
		lichessId,
		fen: '6k1/5ppp/8/8/8/8/8/R5K1 b - - 0 1',
		moves: ['g8h8', 'a1a8'],
		rating: 1500,
		themes: ['backRankMate'],
	};
}

function slot(uuid: string): TrainingRunSlot {
	return { puzzle: apiPuzzle(uuid, `id-${uuid}`), cycleItemUuid: `item-${uuid}`, position: 0 };
}

function solved(puzzleUuid: string): SolvedAttempt {
	const row = { puzzleUuid, slotId: `item-${puzzleUuid}` } as AttemptRow;

	return { row, puzzle: { id: `id-${puzzleUuid}` } as SolvedAttempt['puzzle'] };
}

async function settle(): Promise<void> {
	TestBed.tick();

	await new Promise((resolve) => setTimeout(resolve, 0));

	TestBed.tick();
}

async function configure(entries: readonly SolvedAttempt[], solving = 'puzzle-3') {
	const list = vi.fn().mockResolvedValue(entries);

	TestBed.configureTestingModule({
		providers: [
			TrainingRunStore,
			TrainingReviewStore,
			{ provide: TrainingRunRepository, useValue: {} },
			{ provide: PuzzleCacheUseCase, useValue: { save: vi.fn() } },
			{ provide: TrainingHistoryUseCase, useValue: { list } },
		],
	});

	const run = TestBed.inject(TrainingRunStore);

	patchState(run, { trainingUuid: 'training-1', mode: 'cycle', current: slot(solving) });

	const review = TestBed.inject(TrainingReviewStore);

	await settle();

	return { run, review, list };
}

describe('TrainingReviewStore', () => {
	afterEach(() => {
		TestBed.resetTestingModule();
	});

	it('opens the history on the last exercise that was solved', async () => {
		const { review } = await configure([solved('puzzle-1'), solved('puzzle-2')]);

		expect(review.hasPrevious()).toBe(true);
		expect(review.previous()?.row.puzzleUuid).toBe('puzzle-2');
		expect(review.isReviewing()).toBe(true);
	});

	it('walks back one exercise at a time and stops at the oldest', async () => {
		const { review } = await configure([solved('puzzle-1'), solved('puzzle-2')]);

		review.previous();

		expect(review.previous()?.row.puzzleUuid).toBe('puzzle-1');
		expect(review.hasPrevious()).toBe(false);
		expect(review.previous()).toBeNull();
		expect(review.reviewed()?.row.puzzleUuid).toBe('puzzle-1');
	});

	it('hands the run back once the history runs out going forward', async () => {
		const { review } = await configure([solved('puzzle-1'), solved('puzzle-2')]);

		review.previous();
		review.previous();

		expect(review.forward()?.row.puzzleUuid).toBe('puzzle-2');
		expect(review.hasNext()).toBe(false);
		expect(review.forward()).toBeNull();
		expect(review.isReviewing()).toBe(false);
	});

	it('never offers the exercise that is on the board to be solved', async () => {
		const { review } = await configure([solved('puzzle-1'), solved('puzzle-3')], 'puzzle-3');

		expect(review.available()).toHaveLength(1);
		expect(review.previous()?.row.puzzleUuid).toBe('puzzle-1');
	});

	it('has nothing to go back to before an exercise is on the board', async () => {
		const { review, list } = await configure([solved('puzzle-1')], 'puzzle-3');

		patchState(TestBed.inject(TrainingRunStore), { current: null });

		await settle();

		expect(list).toHaveBeenCalledTimes(1);
		expect(review.hasPrevious()).toBe(false);
	});

	it('reads the history again and lets go of where it was when the run moves on', async () => {
		const { run, review, list } = await configure([solved('puzzle-1')], 'puzzle-3');

		review.previous();
		patchState(run, { current: slot('puzzle-4') });

		await settle();

		expect(list).toHaveBeenCalledTimes(2);
		expect(review.isReviewing()).toBe(false);
	});
});
