import { z } from 'zod';

/**
 * The list an exercise was filed under. One per user and exercise: filing it again moves it,
 * it does not add a second row.
 */
export type PuzzleBookmarkType = 'favorite' | 'hard' | 'easy' | 'unclear';

export interface PuzzleBookmark {
	readonly uuid: string;
	/** The exercise as the front names it, since a local CSV row carries no server uuid. */
	readonly lichessId: string;
	readonly type: PuzzleBookmarkType;
	readonly attemptUuid?: string;
	readonly createdAt: string;
	readonly updatedAt: string;
}

export interface PuzzleBookmarkHistoryEntry {
	readonly uuid: string;
	readonly lichessId: string;
	readonly type: PuzzleBookmarkType | null;
	readonly attemptUuid?: string;
	readonly createdAt: string;
}

export interface UpsertPuzzleBookmarkRequest<TDate = string> {
	type: PuzzleBookmarkType;
	eventUuid?: string;
	attemptUuid?: string;
	/**
	 * When the device filed it. It travels so a bookmark saved offline does not come back
	 * older than the row it is replacing.
	 */
	updatedAt?: TDate;
}

export const upsertPuzzleBookmarkRequestSchema = z.object({
	type: z.enum(['favorite', 'hard', 'easy', 'unclear']),
	eventUuid: z.uuid().optional(),
	attemptUuid: z.uuid().optional(),
	updatedAt: z.iso
		.datetime()
		.transform((value) => new Date(value))
		.optional(),
});

export type UpsertPuzzleBookmarkRequestParsed = z.output<typeof upsertPuzzleBookmarkRequestSchema>;

export const deletePuzzleBookmarkRequestSchema = z.object({
	eventUuid: z.uuid().optional(),
	attemptUuid: z.uuid().optional(),
	updatedAt: z.iso
		.datetime()
		.transform((value) => new Date(value))
		.optional(),
});

export type DeletePuzzleBookmarkRequestParsed = z.output<typeof deletePuzzleBookmarkRequestSchema>;
