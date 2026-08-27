import type { ListNotificationsRequest } from '@chesspecker/api-definitions';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class ListNotificationsRequestDto implements ListNotificationsRequest {
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(100)
	limit?: number;
}
