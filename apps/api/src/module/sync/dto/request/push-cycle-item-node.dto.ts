import type { PushCycleItemNode } from '@chesspecker/api-definitions';
import { Type } from 'class-transformer';
import { IsArray, IsInt, IsUUID, Min, ValidateNested } from 'class-validator';

import { PushAttemptNodeDto } from './push-attempt-node.dto';
import { SyncNodeDto } from './sync-node.dto';

export class PushCycleItemNodeDto extends SyncNodeDto implements PushCycleItemNode<Date> {
	/**
	 * El hueco apunta a un ejercicio del set, que es la única referencia del árbol que
	 * cruza de rama: por eso viaja como nombre y no como anidamiento.
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
