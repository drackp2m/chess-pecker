import type {
	PuzzleBookmark as PuzzleBookmarkResponse,
	UpsertPuzzleBookmarkRequestParsed,
} from '@chesspecker/api-definitions';
import { Injectable } from '@nestjs/common';

import { GenerateNowDateUseCase } from '../../../shared/use-case/generate-now-date.use-case';
import { PuzzleRepository } from '../../puzzle/puzzle.repository';
import { User } from '../../user/user.entity';
import { PuzzleBookmarkType } from '../definition/puzzle-bookmark-type.enum';
import { PuzzleBookmark } from '../puzzle-bookmark.entity';
import { PuzzleBookmarkRepository } from '../puzzle-bookmark.repository';
import { presentBookmark } from '../util/puzzle-bookmark.util';

@Injectable()
export class UpsertPuzzleBookmarkUseCase {
	constructor(
		private readonly puzzleBookmarkRepository: PuzzleBookmarkRepository,
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
		const updatedAt = upsertRequest.updatedAt ?? new GenerateNowDateUseCase().execute();

		const stored = await this.puzzleBookmarkRepository.upsertByPuzzle(
			new PuzzleBookmark({
				user,
				puzzle,
				type: upsertRequest.type as PuzzleBookmarkType,
				updatedAt,
			}),
		);

		return presentBookmark(stored, lichessId);
	}
}
