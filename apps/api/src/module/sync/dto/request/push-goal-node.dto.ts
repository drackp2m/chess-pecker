import type { PushGoalNode } from '@chesspecker/api-definitions';
import { Type } from 'class-transformer';
import { IsDate, IsInt, IsOptional, Min } from 'class-validator';

import { SyncNodeDto } from './sync-node.dto';

export class PushGoalNodeDto extends SyncNodeDto implements PushGoalNode<Date> {
	@IsOptional()
	@IsInt()
	@Min(1)
	puzzlesPerDay?: number;

	@IsOptional()
	@Type(() => Date)
	@IsDate()
	endDate?: Date;
}
