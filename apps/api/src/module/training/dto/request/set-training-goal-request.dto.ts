import { Type } from 'class-transformer';
import { IsDate, IsInt, IsOptional, Min } from 'class-validator';

import { SyncTimestampsDto } from './sync-timestamps.dto';

/**
 * Uno de los dos, o los dos. Se guarda lo que el usuario elige; los días que va a costar se
 * calculan y no se almacenan.
 */
export class SetTrainingGoalRequestDto extends SyncTimestampsDto {
	@IsOptional()
	@IsInt()
	@Min(1)
	puzzlesPerDay?: number;

	@IsOptional()
	@Type(() => Date)
	@IsDate()
	endDate?: Date;
}
