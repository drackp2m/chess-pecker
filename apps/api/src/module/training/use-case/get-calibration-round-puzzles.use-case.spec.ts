import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'vitest-mock-extended';

import { ForbiddenException } from '../../../shared/exception/forbidden.exception';
import { Puzzle } from '../../puzzle/puzzle.entity';
import { CalibrationRoundKind } from '../definition/calibration-round-kind.enum';
import { CalibrationRoundOutcome } from '../definition/calibration-round-outcome.enum';
import { PuzzleAttempt } from '../puzzle-attempt.entity';
import { PuzzleAttemptRepository } from '../puzzle-attempt.repository';
import { TrainingCalibrationPuzzle } from '../training-calibration-puzzle.entity';
import { TrainingCalibrationPuzzleRepository } from '../training-calibration-puzzle.repository';
import { TrainingCalibrationRound } from '../training-calibration-round.entity';
import { TrainingCalibrationRoundRepository } from '../training-calibration-round.repository';
import { Training } from '../training.entity';

import { GetCalibrationRoundPuzzlesUseCase } from './get-calibration-round-puzzles.use-case';

describe('GetCalibrationRoundPuzzlesUseCase', () => {
	let useCase: GetCalibrationRoundPuzzlesUseCase;

	const calibrationRoundRepository = mock<TrainingCalibrationRoundRepository>();
	const calibrationPuzzleRepository = mock<TrainingCalibrationPuzzleRepository>();
	const puzzleAttemptRepository = mock<PuzzleAttemptRepository>();

	const training = new Training({ uuid: 'training-uuid' });

	const dealtPuzzle = (uuid: string, position: number): TrainingCalibrationPuzzle =>
		new TrainingCalibrationPuzzle({ puzzle: new Puzzle({ uuid, rating: 650 }), position });

	beforeAll(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				GetCalibrationRoundPuzzlesUseCase,
				{ provide: TrainingCalibrationRoundRepository, useValue: calibrationRoundRepository },
				{ provide: TrainingCalibrationPuzzleRepository, useValue: calibrationPuzzleRepository },
				{ provide: PuzzleAttemptRepository, useValue: puzzleAttemptRepository },
			],
		}).compile();

		useCase = await module.resolve(GetCalibrationRoundPuzzlesUseCase);
	});

	it('should be defined', () => {
		expect(useCase).toBeDefined();
	});

	describe('execute', () => {
		it('throw ForbiddenException when the round belongs to another training', async () => {
			calibrationRoundRepository.getOne.mockResolvedValueOnce(
				new TrainingCalibrationRound({ training: new Training({ uuid: 'other-training-uuid' }) }),
			);

			const result = useCase.execute(training, 'round-uuid');

			await expect(result).rejects.toThrow(ForbiddenException);

			expect(calibrationPuzzleRepository.getManyByRound).toHaveBeenCalledTimes(0);
		});

		it('return the dealt puzzles that have no attempt yet, in dealt order, with the round size', async () => {
			calibrationRoundRepository.getOne.mockResolvedValueOnce(
				new TrainingCalibrationRound({
					training,
					uuid: 'round-uuid',
					kind: CalibrationRoundKind.Refine,
					rating: 600,
					outcome: CalibrationRoundOutcome.Pending,
				}),
			);
			calibrationPuzzleRepository.getManyByRound.mockResolvedValueOnce([
				dealtPuzzle('first-uuid', 0),
				dealtPuzzle('second-uuid', 1),
				dealtPuzzle('third-uuid', 2),
			]);
			puzzleAttemptRepository.getManyByCalibrationRound.mockResolvedValueOnce([
				new PuzzleAttempt({ puzzle: new Puzzle({ uuid: 'first-uuid' }), solved: true }),
			]);

			const result = await useCase.execute(training, 'round-uuid');

			expect(result.puzzles.map((puzzle) => puzzle.uuid)).toStrictEqual([
				'second-uuid',
				'third-uuid',
			]);
			expect(result.total).toBe(3);
			expect(result.attempted).toBe(1);
		});

		it('return an empty list when every dealt puzzle has been answered', async () => {
			calibrationRoundRepository.getOne.mockResolvedValueOnce(
				new TrainingCalibrationRound({
					training,
					uuid: 'round-uuid',
					kind: CalibrationRoundKind.Scan,
					rating: 600,
					outcome: CalibrationRoundOutcome.Raise,
				}),
			);
			calibrationPuzzleRepository.getManyByRound.mockResolvedValueOnce([
				dealtPuzzle('only-uuid', 0),
			]);
			puzzleAttemptRepository.getManyByCalibrationRound.mockResolvedValueOnce([
				new PuzzleAttempt({ puzzle: new Puzzle({ uuid: 'only-uuid' }), solved: true }),
			]);

			const result = await useCase.execute(training, 'round-uuid');

			expect(result).toStrictEqual({ total: 1, attempted: 1, puzzles: [] });
		});
	});
});
