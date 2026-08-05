import type { SubmitCycleAttemptRequest } from '@chesspecker/api-definitions';
import { IsBoolean, IsEnum, IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

import { PuzzleAttemptClosure } from '../../definition/puzzle-attempt-closure.enum';

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
}
