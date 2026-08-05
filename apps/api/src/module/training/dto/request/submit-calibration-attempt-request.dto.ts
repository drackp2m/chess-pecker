import type { SubmitCalibrationAttemptRequest } from '@chesspecker/api-definitions';
import { IsBoolean, IsEnum, IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

import { PuzzleAttemptClosure } from '../../definition/puzzle-attempt-closure.enum';

import { SyncTimestampsDto } from './sync-timestamps.dto';

export class SubmitCalibrationAttemptRequestDto
	extends SyncTimestampsDto
	implements SubmitCalibrationAttemptRequest<Date>
{
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

	@IsEnum(PuzzleAttemptClosure)
	closure!: PuzzleAttemptClosure;

	@IsBoolean()
	hintUsed!: boolean;

	/** Fallos hasta dar con la solución, que el intento acabe encontrada o rendido. */
	@IsInt()
	@Min(0)
	mistakeCount!: number;
}
