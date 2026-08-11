import type { GetTrainingActivityRequest } from '@chesspecker/api-definitions';
import { Type } from 'class-transformer';
import { IsDate, IsInt, IsOptional, Max, Min } from 'class-validator';

import { TrainingPolicy } from '../../definition/training-policy';

export class GetTrainingActivityRequestDto implements GetTrainingActivityRequest<Date> {
	/** Días que cubre el desglose, hoy incluido. Por defecto, la ventana entera. */
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(TrainingPolicy.activityMaxDays)
	days?: number;

	/** El `cursor` de la respuesta anterior: recorta a los días tocados desde entonces. */
	@IsOptional()
	@Type(() => Date)
	@IsDate()
	since?: Date;
}
