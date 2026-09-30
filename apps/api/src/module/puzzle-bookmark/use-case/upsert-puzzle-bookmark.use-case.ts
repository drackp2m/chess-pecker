import type {
	PuzzleBookmark as PuzzleBookmarkResponse,
	UpsertPuzzleBookmarkRequestParsed,
} from '@chesspecker/api-definitions';
import { Inject, Injectable } from '@nestjs/common';

import { PuzzleRepository } from '../../puzzle/puzzle.repository';
import { User } from '../../user/user.entity';
import { PuzzleBookmarkType } from '../definition/puzzle-bookmark-type.enum';
import { PuzzleBookmark } from '../puzzle-bookmark.entity';
import { PuzzleBookmarkRepository } from '../puzzle-bookmark.repository';
import { clampToNow, presentBookmark } from '../util/puzzle-bookmark.util';

@Injectable()
export class UpsertPuzzleBookmarkUseCase {
	constructor(
		@Inject(PuzzleBookmarkRepository)
		private readonly puzzleBookmarkRepository: PuzzleBookmarkRepository,
		@Inject(PuzzleRepository)
		private readonly puzzleRepository: PuzzleRepository,
	) {}

	/**
	 * An exercise outside the catalogue has no row to point at, so filing it answers 404. The
	 * device keeps its own copy either way: what fails is the trip, not the bookmark.
	 */
	async execute(
		user: User,
		lichessId: string,
		upsertRequest: UpsertPuzzleBookmarkRequestParsed,
	): Promise<PuzzleBookmarkResponse> {
		const puzzle = await this.puzzleRepository.getOne({ lichessId });
		const updatedAt = clampToNow(upsertRequest.updatedAt);

		const stored = await this.puzzleBookmarkRepository.upsertByPuzzle(
			new PuzzleBookmark({
				user,
				puzzle,
				type: upsertRequest.type as PuzzleBookmarkType,
				updatedAt,
			}),
			upsertRequest.eventUuid,
			upsertRequest.attemptUuid,
		);

		return presentBookmark(stored, lichessId);
	}
}
