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
	readonly createdAt: string;
	readonly updatedAt: string;
}

export interface UpsertPuzzleBookmarkRequest<TDate = string> {
	type: PuzzleBookmarkType;
	/**
	 * When the device filed it. It travels so a bookmark saved offline does not come back
	 * older than the row it is replacing.
	 */
	updatedAt?: TDate;
}
