import type { SelectTrainingSetRequest } from '@chesspecker/api-definitions';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class SelectTrainingSetRequestDto implements SelectTrainingSetRequest {
	/** Cuántos ejercicios entran en el entrenamiento. Por defecto, los 1.000 del método. */
	@IsOptional()
	@IsInt()
	@Min(1)
	@Max(5000)
	size?: number;
}
