import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'vitest-mock-extended';

import { ForbiddenException } from '../../../shared/exception/forbidden.exception';
import { PreconditionFailedException } from '../../../shared/exception/precondition-failed.exception';
import { Puzzle } from '../../puzzle/puzzle.entity';
import { CalibrationRoundKind } from '../definition/calibration-round-kind.enum';
import { CalibrationRoundOutcome } from '../definition/calibration-round-outcome.enum';
import { PuzzleAttemptClosure } from '../definition/puzzle-attempt-closure.enum';
import { SubmitCalibrationAttemptRequestDto } from '../dto/request/submit-calibration-attempt-request.dto';
import { PuzzleAttempt } from '../puzzle-attempt.entity';
import { PuzzleAttemptRepository } from '../puzzle-attempt.repository';
import { TrainingCalibrationPuzzle } from '../training-calibration-puzzle.entity';
import { TrainingCalibrationPuzzleRepository } from '../training-calibration-puzzle.repository';
import { TrainingCalibrationRound } from '../training-calibration-round.entity';
import { TrainingCalibrationRoundRepository } from '../training-calibration-round.repository';
import { Training } from '../training.entity';

import { ApplySyncTimestampsUseCase } from './apply-sync-timestamps.use-case';
import { CloseCalibrationRoundUseCase } from './close-calibration-round.use-case';
import { SubmitCalibrationAttemptUseCase } from './submit-calibration-attempt.use-case';

describe('SubmitCalibrationAttemptUseCase', () => {
	let useCase: SubmitCalibrationAttemptUseCase;

	const puzzleAttemptRepository = mock<PuzzleAttemptRepository>();
	const calibrationRoundRepository = mock<TrainingCalibrationRoundRepository>();
	const calibrationPuzzleRepository = mock<TrainingCalibrationPuzzleRepository>();
	const closeCalibrationRoundUseCase = mock<CloseCalibrationRoundUseCase>();
	const applySyncTimestampsUseCase = mock<ApplySyncTimestampsUseCase>();

	const training = new Training({ uuid: 'training-uuid' });

	const submitRequest: SubmitCalibrationAttemptRequestDto = {
		roundUuid: 'round-uuid',
		puzzleUuid: 'puzzle-uuid',
		durationMs: 1000,
		solved: true,
		closure: PuzzleAttemptClosure.Found,
		hintUsed: false,
		mistakeCount: 0,
	};

	const dealtPuzzle = (uuid: string, position: number): TrainingCalibrationPuzzle =>
		new TrainingCalibrationPuzzle({ puzzle: new Puzzle({ uuid, rating: 650 }), position });

	const pendingRound = (kind: CalibrationRoundKind): TrainingCalibrationRound =>
		new TrainingCalibrationRound({
			training,
			uuid: 'round-uuid',
			kind,
			rating: 600,
			outcome: CalibrationRoundOutcome.Pending,
		});

	beforeAll(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				SubmitCalibrationAttemptUseCase,
				{ provide: PuzzleAttemptRepository, useValue: puzzleAttemptRepository },
				{ provide: TrainingCalibrationRoundRepository, useValue: calibrationRoundRepository },
				{ provide: TrainingCalibrationPuzzleRepository, useValue: calibrationPuzzleRepository },
				{ provide: CloseCalibrationRoundUseCase, useValue: closeCalibrationRoundUseCase },
				{ provide: ApplySyncTimestampsUseCase, useValue: applySyncTimestampsUseCase },
			],
		}).compile();

		useCase = await module.resolve(SubmitCalibrationAttemptUseCase);
	});

	it('should be defined', () => {
		expect(useCase).toBeDefined();
	});

	describe('execute', () => {
		it('throw ForbiddenException when the round belongs to another training', async () => {
			calibrationRoundRepository.getOne.mockResolvedValueOnce(
				new TrainingCalibrationRound({ training: new Training({ uuid: 'other-training-uuid' }) }),
			);

			const result = useCase.execute(training, submitRequest);

			await expect(result).rejects.toThrow(ForbiddenException);

			expect(calibrationPuzzleRepository.getManyByRound).toHaveBeenCalledTimes(0);
		});

		it('throw PreconditionFailedException when the round is already closed', async () => {
			calibrationRoundRepository.getOne.mockResolvedValueOnce(
				new TrainingCalibrationRound({ training, outcome: CalibrationRoundOutcome.Accept }),
			);

			const result = useCase.execute(training, submitRequest);

			await expect(result).rejects.toThrow(PreconditionFailedException);
			await expect(result).rejects.toMatchObject({ response: { calibration: 'already closed' } });

			expect(calibrationPuzzleRepository.getManyByRound).toHaveBeenCalledTimes(0);
		});

		it('throw PreconditionFailedException when the puzzle was not dealt by the round', async () => {
			calibrationRoundRepository.getOne.mockResolvedValueOnce(
				pendingRound(CalibrationRoundKind.Scan),
			);
			calibrationPuzzleRepository.getManyByRound.mockResolvedValueOnce([
				dealtPuzzle('another-puzzle-uuid', 0),
			]);

			const result = useCase.execute(training, submitRequest);

			await expect(result).rejects.toThrow(PreconditionFailedException);
			await expect(result).rejects.toMatchObject({
				response: { puzzle: 'not dealt in this round' },
			});

			expect(puzzleAttemptRepository.insert).toHaveBeenCalledTimes(0);
		});

		it('throw PreconditionFailedException when the puzzle was already attempted in the round', async () => {
			calibrationRoundRepository.getOne.mockResolvedValueOnce(
				pendingRound(CalibrationRoundKind.Refine),
			);
			calibrationPuzzleRepository.getManyByRound.mockResolvedValueOnce([
				dealtPuzzle('puzzle-uuid', 0),
			]);
			puzzleAttemptRepository.getManyByCalibrationRound.mockResolvedValueOnce([
				new PuzzleAttempt({ puzzle: new Puzzle({ uuid: 'puzzle-uuid' }), solved: true }),
			]);

			const result = useCase.execute(training, submitRequest);

			await expect(result).rejects.toThrow(PreconditionFailedException);
			await expect(result).rejects.toMatchObject({ response: { puzzle: 'already attempted' } });

			expect(puzzleAttemptRepository.insert).toHaveBeenCalledTimes(0);
		});

		it('keep the round pending while dealt puzzles are still unanswered', async () => {
			calibrationRoundRepository.getOne.mockResolvedValueOnce(
				pendingRound(CalibrationRoundKind.Refine),
			);
			calibrationPuzzleRepository.getManyByRound.mockResolvedValueOnce([
				dealtPuzzle('puzzle-uuid', 0),
				dealtPuzzle('second-puzzle-uuid', 1),
			]);
			puzzleAttemptRepository.getManyByCalibrationRound.mockResolvedValueOnce([]);
			applySyncTimestampsUseCase.execute.mockImplementationOnce((entity) => entity);

			const result = await useCase.execute(training, submitRequest);

			expect(result.outcome).toStrictEqual(CalibrationRoundOutcome.Pending);
			expect(puzzleAttemptRepository.insert).toHaveBeenCalledTimes(1);
			expect(closeCalibrationRoundUseCase.execute).toHaveBeenCalledTimes(0);
		});

		it('close the round once every dealt puzzle has an attempt', async () => {
			const round = pendingRound(CalibrationRoundKind.Scan);
			const existing = new PuzzleAttempt({
				puzzle: new Puzzle({ uuid: 'second-puzzle-uuid' }),
				solved: false,
			});

			calibrationRoundRepository.getOne.mockResolvedValueOnce(round);
			calibrationPuzzleRepository.getManyByRound.mockResolvedValueOnce([
				dealtPuzzle('puzzle-uuid', 0),
				dealtPuzzle('second-puzzle-uuid', 1),
			]);
			puzzleAttemptRepository.getManyByCalibrationRound.mockResolvedValueOnce([existing]);
			applySyncTimestampsUseCase.execute.mockImplementationOnce((entity) => entity);
			calibrationRoundRepository.getManyByTraining.mockResolvedValueOnce([round]);
			closeCalibrationRoundUseCase.execute.mockResolvedValueOnce(CalibrationRoundOutcome.Raise);

			const result = await useCase.execute(training, submitRequest);

			expect(result.outcome).toStrictEqual(CalibrationRoundOutcome.Raise);
			expect(closeCalibrationRoundUseCase.execute).toHaveBeenCalledTimes(1);
			expect(closeCalibrationRoundUseCase.execute).toHaveBeenCalledWith(
				round,
				[existing, result.attempt],
				[],
			);
		});
	});
});
