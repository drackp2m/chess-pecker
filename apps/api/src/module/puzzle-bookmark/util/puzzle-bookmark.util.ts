import type { PuzzleBookmark as PuzzleBookmarkResponse } from '@chesspecker/api-definitions';

import { GenerateNowDateUseCase } from '../../../shared/use-case/generate-now-date.use-case';
import { toIsoDate } from '../../../shared/util/to-iso-date';
import { PuzzleBookmark } from '../puzzle-bookmark.entity';

/**
 * The exercise leaves as its `lichessId` and not as our uuid, which is the only name the
 * front has for it: a row imported from a CSV never learned any other. It comes in beside
 * the bookmark because an upsert answers with a reference nobody loaded.
 */
export function presentBookmark(
	bookmark: PuzzleBookmark,
	lichessId: string,
): PuzzleBookmarkResponse {
	return {
		uuid: bookmark.uuid,
		lichessId,
		type: bookmark.type,
		...(undefined === bookmark.attemptUuid ? {} : { attemptUuid: bookmark.attemptUuid }),
		createdAt: toIsoDate(bookmark.createdAt),
		updatedAt: toIsoDate(bookmark.updatedAt),
	};
}

export function clampToNow(updatedAt?: Date): Date {
	const now = new GenerateNowDateUseCase().execute();

	return undefined === updatedAt || updatedAt > now ? now : updatedAt;
}
