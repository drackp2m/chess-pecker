import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';

import { PuzzleAttempt } from './puzzle-attempt.entity';
import { TrainingCalibrationPuzzle } from './training-calibration-puzzle.entity';
import { TrainingCalibrationRound } from './training-calibration-round.entity';
import { TrainingCalibrationController } from './training-calibration.controller';
import { TrainingCycleItem } from './training-cycle-item.entity';
import { TrainingCycleController } from './training-cycle.controller';
import { TrainingCycle } from './training-cycle.entity';
import { TrainingGoal } from './training-goal.entity';
import { TrainingPuzzle } from './training-puzzle.entity';
import { TrainingController } from './training.controller';
import { Training } from './training.entity';
import { ApplySyncTimestampsUseCase } from './use-case/apply-sync-timestamps.use-case';
import { FinishTrainingUseCase } from './use-case/finish-training.use-case';
import { GetCalibrationRoundPuzzlesUseCase } from './use-case/get-calibration-round-puzzles.use-case';
import { GetNextCycleItemUseCase } from './use-case/get-next-cycle-item.use-case';
import { GetOwnedTrainingUseCase } from './use-case/get-owned-training.use-case';
import { GetTrainingActivityUseCase } from './use-case/get-training-activity.use-case';
import { GetTrainingProgressUseCase } from './use-case/get-training-progress.use-case';
import { ListTrainingAttemptsUseCase } from './use-case/list-training-attempts.use-case';
import { ListTrainingsUseCase } from './use-case/list-trainings.use-case';
import { StartTrainingUseCase } from './use-case/start-training.use-case';

@Module({
	imports: [
		MikroOrmModule.forFeature([
			Training,
			TrainingGoal,
			TrainingCalibrationRound,
			TrainingCalibrationPuzzle,
			TrainingPuzzle,
			TrainingCycle,
			TrainingCycleItem,
			PuzzleAttempt,
		]),
	],
	providers: [
		GetOwnedTrainingUseCase,
		StartTrainingUseCase,
		ListTrainingsUseCase,
		GetCalibrationRoundPuzzlesUseCase,
		GetNextCycleItemUseCase,
		GetTrainingProgressUseCase,
		GetTrainingActivityUseCase,
		ListTrainingAttemptsUseCase,
		FinishTrainingUseCase,
		ApplySyncTimestampsUseCase,
	],
	// La cordura de las fechas del cliente la comparte la subida del módulo de
	// sincronización, que escribe en estas mismas tablas.
	exports: [MikroOrmModule, ApplySyncTimestampsUseCase],
	controllers: [TrainingController, TrainingCalibrationController, TrainingCycleController],
})
export class TrainingModule {}
