import { Module } from '@nestjs/common';

import { PuzzleModule } from '../puzzle/puzzle.module';
import { TrainingModule } from '../training/training.module';

import { SyncController } from './sync.controller';
import { GetSyncSummaryUseCase } from './use-case/get-sync-summary.use-case';
import { PushCalibrationBranchUseCase } from './use-case/push-calibration-branch.use-case';
import { PushCycleBranchUseCase } from './use-case/push-cycle-branch.use-case';
import { PushSyncAttemptUseCase } from './use-case/push-sync-attempt.use-case';
import { PushTrainingTreeUseCase } from './use-case/push-training-tree.use-case';

@Module({
	imports: [TrainingModule, PuzzleModule],
	providers: [
		GetSyncSummaryUseCase,
		PushTrainingTreeUseCase,
		PushCalibrationBranchUseCase,
		PushCycleBranchUseCase,
		PushSyncAttemptUseCase,
	],
	controllers: [SyncController],
})
export class SyncModule {}
