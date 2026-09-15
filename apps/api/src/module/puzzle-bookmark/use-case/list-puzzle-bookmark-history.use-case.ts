import type { PuzzleBookmarkHistoryEntry } from '@chesspecker/api-definitions';
import { Inject, Injectable } from '@nestjs/common';

import { User } from '../../user/user.entity';
import { PuzzleBookmarkRepository } from '../puzzle-bookmark.repository';

@Injectable()
export class ListPuzzleBookmarkHistoryUseCase {
	constructor(
		@Inject(PuzzleBookmarkRepository)
		private readonly puzzleBookmarkRepository: PuzzleBookmarkRepository,
	) {}

	async execute(user: User): Promise<PuzzleBookmarkHistoryEntry[]> {
		const history = await this.puzzleBookmarkRepository.getHistory(user.uuid);

		return history.map((entry) => ({
			uuid: entry.uuid,
			lichessId: entry.puzzle.lichessId,
			type: entry.type ?? null,
			createdAt: entry.createdAt.toISOString(),
			...(undefined === entry.attemptUuid ? {} : { attemptUuid: entry.attemptUuid }),
		}));
	}
}
