import type { GetTrainingActivityRequest } from '@chesspecker/api-definitions';
import { Type } from 'class-transformer';
import { IsDate, IsInt, IsOptional, Max, Min } from 'class-validator';

import { TrainingPolicy } from '../../definition/training-policy';

export class GetTrainingActivityRequestDto implements GetTrainingActivityRequest<Date> {
	/** Days the breakdown covers, today included. Defaults to the whole window. */
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(TrainingPolicy.activityMaxDays)
	days?: number;

	/** The previous response's `cursor`: narrows it to the days touched since. */
	@IsOptional()
	@Type(() => Date)
	@IsDate()
	since?: Date;
}
