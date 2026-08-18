import type { PushTrainingNode } from '@chesspecker/api-definitions';
import { Type } from 'class-transformer';
import { IsArray, IsDate, IsEnum, IsOptional, ValidateNested } from 'class-validator';

import { TrainingFinishedReason } from '../../../training/definition/training-finished-reason.enum';
import { TrainingStatus } from '../../../training/definition/training-status.enum';

import { PushCalibrationRoundNodeDto } from './push-calibration-round-node.dto';
import { PushCycleNodeDto } from './push-cycle-node.dto';
import { PushGoalNodeDto } from './push-goal-node.dto';
import { PushTrainingPuzzleNodeDto } from './push-training-puzzle-node.dto';
import { SyncNodeDto } from './sync-node.dto';

export class PushTrainingNodeDto extends SyncNodeDto implements PushTrainingNode<Date> {
	@IsEnum(TrainingStatus)
	status!: TrainingStatus;

	@IsOptional()
	@IsEnum(TrainingFinishedReason)
	finishedReason?: TrainingFinishedReason;

	@IsOptional()
	@Type(() => Date)
	@IsDate()
	finishedAt?: Date;

	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => PushGoalNodeDto)
	goals!: PushGoalNodeDto[];

	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => PushCalibrationRoundNodeDto)
	rounds!: PushCalibrationRoundNodeDto[];

	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => PushTrainingPuzzleNodeDto)
	puzzles!: PushTrainingPuzzleNodeDto[];

	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => PushCycleNodeDto)
	cycles!: PushCycleNodeDto[];
}
