import type { PushCycleNode } from '@chesspecker/api-definitions';
import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsInt, Min, ValidateNested } from 'class-validator';

import { TrainingCycleStatus } from '../../../training/definition/training-cycle-status.enum';

import { PushCycleItemNodeDto } from './push-cycle-item-node.dto';
import { SyncNodeDto } from './sync-node.dto';

export class PushCycleNodeDto extends SyncNodeDto implements PushCycleNode<Date> {
	@IsInt()
	@Min(1)
	index!: number;

	@IsEnum(TrainingCycleStatus)
	status!: TrainingCycleStatus;

	@IsInt()
	@Min(1)
	itemCount!: number;

	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => PushCycleItemNodeDto)
	items!: PushCycleItemNodeDto[];
}
