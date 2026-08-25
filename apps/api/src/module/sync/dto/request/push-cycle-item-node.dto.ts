import type { PushCycleItemNode } from '@chesspecker/api-definitions';
import { Type } from 'class-transformer';
import { IsArray, IsInt, IsUUID, Min, ValidateNested } from 'class-validator';

import { PushAttemptNodeDto } from './push-attempt-node.dto';
import { SyncNodeDto } from './sync-node.dto';

export class PushCycleItemNodeDto extends SyncNodeDto implements PushCycleItemNode<Date> {
	/**
	 * The slot points at an exercise in the set, the only reference in the tree that crosses
	 * branches, which is why it travels as a name and not as nesting.
	 */
	@IsUUID()
	trainingPuzzleRef!: string;

	@IsInt()
	@Min(0)
	position!: number;

	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => PushAttemptNodeDto)
	attempts!: PushAttemptNodeDto[];
}
