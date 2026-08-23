import type { FreePlayRun, PushAttemptNode, PuzzleEvent } from '@chesspecker/api-definitions';
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

import { PuzzleAttemptClosure } from '../../../training/definition/puzzle-attempt-closure.enum';
import { FreePlayRunDto } from '../../../training/dto/request/free-play-run.dto';

import { SyncNodeDto } from './sync-node.dto';

/**
 * The exercise travels as a `lichessId`: one imported from a CSV has no server uuid, so
 * translating it to the catalogue is the server's job.
 */
export class PushAttemptNodeDto extends SyncNodeDto implements PushAttemptNode<Date> {
	@IsString()
	@IsNotEmpty()
	lichessId!: string;

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
