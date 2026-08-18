import type { GetSyncTrainingTreeRequest } from '@chesspecker/api-definitions';
import { Type } from 'class-transformer';
import { IsDate, IsOptional } from 'class-validator';

export class GetTrainingTreeRequestDto implements GetSyncTrainingTreeRequest<Date> {
	@IsOptional()
	@Type(() => Date)
	@IsDate()
	since?: Date;
}
