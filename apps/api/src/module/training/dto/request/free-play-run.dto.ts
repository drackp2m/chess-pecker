import type { FreePlayRun, PuzzleEvent } from '@chesspecker/api-definitions';
import { IsArray, IsInt, Min } from 'class-validator';

export class FreePlayRunDto implements FreePlayRun {
	@IsInt()
	@Min(0)
	at!: number;

	@IsArray()
	events!: PuzzleEvent[];
}
