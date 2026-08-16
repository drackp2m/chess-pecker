import type { GetTrainingAttemptsRequest } from '@chesspecker/api-definitions';
import { Type } from 'class-transformer';
import { IsDate, IsInt, IsOptional, Max, Min } from 'class-validator';

import { TrainingPolicy } from '../../definition/training-policy';

export class GetTrainingAttemptsRequestDto implements GetTrainingAttemptsRequest<Date> {
	/** El `cursor` de la respuesta anterior: recorta a lo recibido desde entonces. */
	@IsOptional()
	@Type(() => Date)
	@IsDate()
	since?: Date;

	/** Intentos por página. Por defecto, la página entera. */
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(TrainingPolicy.attemptPageSize)
	limit?: number;
}
