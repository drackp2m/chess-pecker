import { IsBoolean, IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

import { SyncTimestampsDto } from './sync-timestamps.dto';

export class SubmitCalibrationAttemptRequestDto extends SyncTimestampsDto {
	@IsString()
	@IsNotEmpty()
	roundUuid!: string;

	@IsString()
	@IsNotEmpty()
	puzzleUuid!: string;

	/** Tiempo acumulado con el ejercicio a la vista, que lo lleva el front. */
	@IsInt()
	@Min(0)
	durationMs!: number;

	@IsBoolean()
	solved!: boolean;
}
