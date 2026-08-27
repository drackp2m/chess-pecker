import type { PuzzleShareResultRequest } from '@chesspecker/api-definitions';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

import { PuzzleAttemptClosure } from '../../../training/definition/puzzle-attempt-closure.enum';

/** A day of solving, so a clock that ran while the tab slept cannot come back as a record. */
const MAX_DURATION_MS = 24 * 60 * 60 * 1000;

export class PuzzleShareResultRequestDto implements PuzzleShareResultRequest {
	@IsBoolean()
	solved!: boolean;

	@IsEnum(PuzzleAttemptClosure)
	closure!: PuzzleAttemptClosure;

	@IsBoolean()
	hintUsed!: boolean;

	@Type(() => Number)
	@IsInt()
	@Min(0)
	mistakeCount!: number;

	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(0)
	@Max(MAX_DURATION_MS)
	durationMs?: number;
}
