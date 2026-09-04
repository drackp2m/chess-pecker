import { Inject, Injectable } from '@nestjs/common';

import { PuzzleRepository } from '../../puzzle/puzzle.repository';
import { User } from '../../user/user.entity';
import { PuzzleBookmarkRepository } from '../puzzle-bookmark.repository';

@Injectable()
export class DeletePuzzleBookmarkUseCase {
	constructor(
		@Inject(PuzzleBookmarkRepository)
		private readonly puzzleBookmarkRepository: PuzzleBookmarkRepository,
		@Inject(PuzzleRepository)
		private readonly puzzleRepository: PuzzleRepository,
	) {}

	/** Unfiling an exercise that was never filed is not an error: it ends up unfiled either way. */
	async execute(user: User, lichessId: string): Promise<void> {
		const puzzle = await this.puzzleRepository.getOne({ lichessId });

		await this.puzzleBookmarkRepository.deleteMany({ user: user.uuid, puzzle: puzzle.uuid });
	}
}
