import type { PushTrainingPuzzleNode } from '@chesspecker/api-definitions';
import { IsNotEmpty, IsString } from 'class-validator';

import { SyncNodeDto } from './sync-node.dto';

export class PushTrainingPuzzleNodeDto extends SyncNodeDto implements PushTrainingPuzzleNode<Date> {
	@IsString()
	@IsNotEmpty()
	lichessId!: string;
}
