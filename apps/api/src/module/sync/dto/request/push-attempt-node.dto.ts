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
 * El ejercicio va por `lichessId` y no por uuid: el store local de ejercicios se clava por
 * él, y uno importado de un CSV no tiene uuid de servidor. Traducirlo al catálogo es cosa
 * del servidor.
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
