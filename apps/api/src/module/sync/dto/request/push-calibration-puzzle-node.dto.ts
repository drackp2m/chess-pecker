import type { PushCalibrationPuzzleNode } from '@chesspecker/api-definitions';
import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

import { SyncNodeDto } from './sync-node.dto';

export class PushCalibrationPuzzleNodeDto
	extends SyncNodeDto
	implements PushCalibrationPuzzleNode<Date>
{
	@IsString()
	@IsNotEmpty()
	lichessId!: string;

	@IsInt()
	@Min(0)
	position!: number;
}
