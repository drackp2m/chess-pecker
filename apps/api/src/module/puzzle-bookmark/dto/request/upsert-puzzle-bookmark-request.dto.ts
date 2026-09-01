import type { UpsertPuzzleBookmarkRequest } from '@chesspecker/api-definitions';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsOptional } from 'class-validator';

import { PuzzleBookmarkType } from '../../definition/puzzle-bookmark-type.enum';

/**
 * `updatedAt` travels for the same reason the training tree's does: a device that filed the
 * exercise offline would otherwise arrive looking newer than the row it is replacing.
 */
export class UpsertPuzzleBookmarkRequestDto implements UpsertPuzzleBookmarkRequest<Date> {
	@IsEnum(PuzzleBookmarkType)
	type!: PuzzleBookmarkType;

	@IsOptional()
	@Type(() => Date)
	@IsDate()
	updatedAt?: Date;
}
