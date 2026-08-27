import type { PuzzleBookmark as PuzzleBookmarkResponse } from '@chesspecker/api-definitions';
import { Injectable } from '@nestjs/common';

import { User } from '../../user/user.entity';
import { PuzzleBookmarkRepository } from '../puzzle-bookmark.repository';
import { presentBookmark } from '../util/puzzle-bookmark.util';

@Injectable()
export class ListPuzzleBookmarksUseCase {
	constructor(private readonly puzzleBookmarkRepository: PuzzleBookmarkRepository) {}

	/** Every list at once: there are as many rows as exercises the user has filed, and no more. */
	async execute(user: User): Promise<PuzzleBookmarkResponse[]> {
		const bookmarks = await this.puzzleBookmarkRepository.getMany(
			{ user: user.uuid },
			{ populate: ['puzzle'] },
		);

		return bookmarks.map((bookmark) => presentBookmark(bookmark, bookmark.puzzle.lichessId));
	}
}
