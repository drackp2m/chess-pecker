import type { GetTrainingAttemptsRequest } from '@chesspecker/api-definitions';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

import { TrainingPolicy } from '../../definition/training-policy';

export class GetTrainingAttemptsRequestDto implements GetTrainingAttemptsRequest {
	/** The previous response's `cursor`: the attempt the page was cut at. */
	@IsOptional()
	@IsString()
	@MaxLength(255)
	since?: string;

	/** Attempts per page. Defaults to the whole page. */
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(TrainingPolicy.attemptPageSize)
	limit?: number;
}
