import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';

import { PuzzleModule } from '../puzzle/puzzle.module';

import { PuzzleAttempt } from './puzzle-attempt.entity';
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
import { CloseCalibrationRoundUseCase } from './use-case/close-calibration-round.use-case';
import { CreateCalibrationRoundUseCase } from './use-case/create-calibration-round.use-case';
import { FinishTrainingUseCase } from './use-case/finish-training.use-case';
import { GetNextCycleItemUseCase } from './use-case/get-next-cycle-item.use-case';
import { GetOwnedTrainingUseCase } from './use-case/get-owned-training.use-case';
import { GetTrainingProgressUseCase } from './use-case/get-training-progress.use-case';
import { ListTrainingsUseCase } from './use-case/list-trainings.use-case';
import { SelectTrainingSetUseCase } from './use-case/select-training-set.use-case';
import { SetTrainingGoalUseCase } from './use-case/set-training-goal.use-case';
import { StartNextCycleUseCase } from './use-case/start-next-cycle.use-case';
import { StartTrainingUseCase } from './use-case/start-training.use-case';
import { SubmitCalibrationAttemptUseCase } from './use-case/submit-calibration-attempt.use-case';
import { SubmitCycleAttemptUseCase } from './use-case/submit-cycle-attempt.use-case';

@Module({
	imports: [
		MikroOrmModule.forFeature([
			Training,
			TrainingGoal,
			TrainingCalibrationRound,
			TrainingPuzzle,
			TrainingCycle,
			TrainingCycleItem,
			PuzzleAttempt,
		]),
		PuzzleModule,
	],
	providers: [
		GetOwnedTrainingUseCase,
		StartTrainingUseCase,
		ListTrainingsUseCase,
		CreateCalibrationRoundUseCase,
		CloseCalibrationRoundUseCase,
		SubmitCalibrationAttemptUseCase,
		SelectTrainingSetUseCase,
		SetTrainingGoalUseCase,
		StartNextCycleUseCase,
		GetNextCycleItemUseCase,
		SubmitCycleAttemptUseCase,
		GetTrainingProgressUseCase,
		FinishTrainingUseCase,
		ApplySyncTimestampsUseCase,
	],
	exports: [MikroOrmModule],
	controllers: [TrainingController, TrainingCalibrationController, TrainingCycleController],
})
export class TrainingModule {}
