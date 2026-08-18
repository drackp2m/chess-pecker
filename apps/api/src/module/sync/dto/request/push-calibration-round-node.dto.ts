import type { PushCalibrationRoundNode } from '@chesspecker/api-definitions';
import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsInt, Min, ValidateNested } from 'class-validator';

import { CalibrationRoundKind } from '../../../training/definition/calibration-round-kind.enum';
import { CalibrationRoundOutcome } from '../../../training/definition/calibration-round-outcome.enum';

import { PushAttemptNodeDto } from './push-attempt-node.dto';
import { PushCalibrationPuzzleNodeDto } from './push-calibration-puzzle-node.dto';
import { SyncNodeDto } from './sync-node.dto';

export class PushCalibrationRoundNodeDto
	extends SyncNodeDto
	implements PushCalibrationRoundNode<Date>
{
	@IsInt()
	@Min(1)
	index!: number;

	@IsEnum(CalibrationRoundKind)
	kind!: CalibrationRoundKind;

	@IsInt()
	@Min(0)
	rating!: number;

	@IsEnum(CalibrationRoundOutcome)
	outcome!: CalibrationRoundOutcome;

	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => PushCalibrationPuzzleNodeDto)
	puzzles!: PushCalibrationPuzzleNodeDto[];

	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => PushAttemptNodeDto)
	attempts!: PushAttemptNodeDto[];
}
