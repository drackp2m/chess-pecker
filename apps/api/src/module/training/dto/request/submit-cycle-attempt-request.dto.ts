import type {
	FreePlayRun,
	PuzzleEvent,
	SubmitCycleAttemptRequest,
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

export class SubmitCycleAttemptRequestDto
	extends SyncTimestampsDto
	implements SubmitCycleAttemptRequest<Date>
{
	/** El ejercicio sale del item, que ya dice cuál toca y en qué posición del ciclo. */
	@IsString()
	@IsNotEmpty()
	cycleItemUuid!: string;

	@IsInt()
	@Min(0)
	durationMs!: number;

	@IsBoolean()
	solved!: boolean;

	@IsEnum(PuzzleAttemptClosure)
	closure!: PuzzleAttemptClosure;

	@IsBoolean()
	hintUsed!: boolean;

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
