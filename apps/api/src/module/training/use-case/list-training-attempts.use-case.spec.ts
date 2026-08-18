import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'vitest-mock-extended';

import { Puzzle } from '../../puzzle/puzzle.entity';
import { PuzzleAttemptClosure } from '../definition/puzzle-attempt-closure.enum';
import { PuzzleAttemptKind } from '../definition/puzzle-attempt-kind.enum';
import { TrainingPolicy } from '../definition/training-policy';
import { PuzzleAttempt } from '../puzzle-attempt.entity';
import { PuzzleAttemptRepository } from '../puzzle-attempt.repository';
import { TrainingCalibrationRound } from '../training-calibration-round.entity';
import { TrainingCycleItem } from '../training-cycle-item.entity';
import { Training } from '../training.entity';

import { ListTrainingAttemptsUseCase } from './list-training-attempts.use-case';

describe('ListTrainingAttemptsUseCase', () => {
	let useCase: ListTrainingAttemptsUseCase;

	const puzzleAttemptRepository = mock<PuzzleAttemptRepository>();

	const training = new Training({ uuid: 'training-uuid' });
	const puzzle = new Puzzle({ uuid: 'puzzle-uuid', lichessId: 'AAA11', rating: 1500 });

	const cycleAttempt = (uuid = 'attempt-uuid'): PuzzleAttempt => {
		const attempt = new PuzzleAttempt({
			uuid,
			training,
			kind: PuzzleAttemptKind.Cycle,
			cycleItem: new TrainingCycleItem({ uuid: 'item-uuid', position: 3 }),
			puzzle,
			durationMs: 4200,
			solved: true,
			closure: PuzzleAttemptClosure.Found,
			hintUsed: false,
			mistakeCount: 1,
			record: ['g8h8', 'a1a8'],
			explorations: [],
			createdAt: new Date('2026-08-11T10:00:00.000Z'),
			updatedAt: new Date('2026-08-11T10:00:30.000Z'),
		});

		// El hueco que no es el suyo vuelve de la base como `null`, no como `undefined`.
		Object.assign(attempt, { calibrationRound: null });

		return attempt;
	};

	const calibrationAttempt = (): PuzzleAttempt => {
		const attempt = new PuzzleAttempt({
			uuid: 'other-attempt-uuid',
			training,
			kind: PuzzleAttemptKind.Calibration,
			calibrationRound: new TrainingCalibrationRound({ uuid: 'round-uuid' }),
			puzzle,
			durationMs: 1000,
			solved: false,
			closure: PuzzleAttemptClosure.Revealed,
			hintUsed: true,
			mistakeCount: 0,
			record: [],
			explorations: [{ at: 0, events: ['e2e4'] }],
		});

		Object.assign(attempt, { cycleItem: null });

		return attempt;
	};

	beforeAll(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				ListTrainingAttemptsUseCase,
				{ provide: PuzzleAttemptRepository, useValue: puzzleAttemptRepository },
			],
		}).compile();

		useCase = await module.resolve(ListTrainingAttemptsUseCase);
	});

	beforeEach(() => {
		puzzleAttemptRepository.getPageByTraining.mockResolvedValue([]);
	});

	it('should be defined', () => {
		expect(useCase).toBeDefined();
	});

	describe('execute', () => {
		it('hands back the exercise and the slot the attempt belongs to', async () => {
			puzzleAttemptRepository.getPageByTraining.mockResolvedValueOnce([cycleAttempt()]);

			const { attempts } = await useCase.execute(training, {});

			expect(attempts).toHaveLength(1);
			expect(attempts[0]).toMatchObject({
				uuid: 'attempt-uuid',
				kind: PuzzleAttemptKind.Cycle,
				cycleItemUuid: 'item-uuid',
				position: 3,
				durationMs: 4200,
				solved: true,
				closure: PuzzleAttemptClosure.Found,
				hintUsed: false,
				mistakeCount: 1,
				record: ['g8h8', 'a1a8'],
				createdAt: '2026-08-11T10:00:00.000Z',
				updatedAt: '2026-08-11T10:00:30.000Z',
			});
			expect(attempts[0]?.puzzle.lichessId).toStrictEqual('AAA11');
			expect(attempts[0]?.roundUuid).toBeUndefined();
		});

		it('names the round of a calibration attempt instead of the cycle item', async () => {
			puzzleAttemptRepository.getPageByTraining.mockResolvedValueOnce([calibrationAttempt()]);

			const { attempts } = await useCase.execute(training, {});

			expect(attempts[0]?.roundUuid).toStrictEqual('round-uuid');
			expect(attempts[0]?.cycleItemUuid).toBeUndefined();
			expect(attempts[0]?.explorations).toStrictEqual([{ at: 0, events: ['e2e4'] }]);
		});

		it('asks only for what came in after the row it was given', async () => {
			await useCase.execute(training, { since: 'last-attempt-uuid' });

			expect(puzzleAttemptRepository.getPageByTraining).toHaveBeenCalledWith(
				'training-uuid',
				TrainingPolicy.attemptPageSize,
				'last-attempt-uuid',
			);
		});

		it('starts from the beginning when the cursor comes in blank', async () => {
			await useCase.execute(training, { since: '  ' });

			expect(puzzleAttemptRepository.getPageByTraining).toHaveBeenCalledWith(
				'training-uuid',
				TrainingPolicy.attemptPageSize,
				undefined,
			);
		});

		it('hands the cursor back untouched when nothing came after it', async () => {
			const { cursor, hasMore } = await useCase.execute(training, { since: 'last-attempt-uuid' });

			expect(cursor).toStrictEqual('last-attempt-uuid');
			expect(hasMore).toBe(false);
		});

		it('never serves a page bigger than the one the policy allows', async () => {
			await useCase.execute(training, { limit: TrainingPolicy.attemptPageSize + 100 });

			expect(puzzleAttemptRepository.getPageByTraining).toHaveBeenCalledWith(
				'training-uuid',
				TrainingPolicy.attemptPageSize,
				undefined,
			);
		});

		it('ends a full page at its last row, which is where the next one starts', async () => {
			puzzleAttemptRepository.getPageByTraining.mockResolvedValueOnce([
				cycleAttempt('first-uuid'),
				cycleAttempt('last-uuid'),
			]);

			const { cursor, hasMore } = await useCase.execute(training, { limit: 2 });

			expect(hasMore).toBe(true);
			expect(cursor).toStrictEqual('last-uuid');
		});

		it('closes the paging on the page that comes back short', async () => {
			puzzleAttemptRepository.getPageByTraining.mockResolvedValueOnce([cycleAttempt('last-uuid')]);

			const { cursor, hasMore } = await useCase.execute(training, { limit: 2 });

			expect(hasMore).toBe(false);
			expect(cursor).toStrictEqual('last-uuid');
		});

		it('comes back with an empty cursor when the training has no attempts yet', async () => {
			const { attempts, cursor, hasMore } = await useCase.execute(training, {});

			expect(attempts).toStrictEqual([]);
			expect(cursor).toStrictEqual('');
			expect(hasMore).toBe(false);
		});
	});
});
