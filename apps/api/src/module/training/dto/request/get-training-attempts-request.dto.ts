import type { GetTrainingAttemptsRequest } from '@chesspecker/api-definitions';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

import { TrainingPolicy } from '../../definition/training-policy';

export class GetTrainingAttemptsRequestDto implements GetTrainingAttemptsRequest {
	/** El `cursor` de la respuesta anterior: el intento por el que se cortó la página. */
	@IsOptional()
	@IsString()
	@MaxLength(255)
	since?: string;

	/** Intentos por página. Por defecto, la página entera. */
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(TrainingPolicy.attemptPageSize)
	limit?: number;
}
