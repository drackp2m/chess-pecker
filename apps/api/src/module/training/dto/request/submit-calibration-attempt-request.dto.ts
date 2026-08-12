import type {
	FreePlayRun,
	PuzzleEvent,
	SubmitCalibrationAttemptRequest,
} from '@chesspecker/api-definitions';
import { Type } from 'class-transformer';
import {
	IsArray,
	IsBoolean,
	IsEnum,
	IsInt,
	IsNotEmpty,
	IsString,
	Min,
	ValidateNested,
} from 'class-validator';

import { PuzzleAttemptClosure } from '../../definition/puzzle-attempt-closure.enum';

import { FreePlayRunDto } from './free-play-run.dto';
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

	@IsArray()
	record!: PuzzleEvent[];

	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => FreePlayRunDto)
	explorations!: FreePlayRun[];
}
