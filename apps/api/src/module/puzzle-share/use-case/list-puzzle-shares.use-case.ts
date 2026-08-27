import type { PuzzleShare as PuzzleShareResponse } from '@chesspecker/api-definitions';
import { Injectable } from '@nestjs/common';

import { User } from '../../user/user.entity';
import { PuzzleShareRecipientRepository } from '../puzzle-share-recipient.repository';
import { PuzzleShareRepository } from '../puzzle-share.repository';

import { PresentPuzzleSharesUseCase } from './present-puzzle-shares.use-case';

const DEFAULT_LIMIT = 50;

@Injectable()
export class ListPuzzleSharesUseCase {
	constructor(
		private readonly puzzleShareRepository: PuzzleShareRepository,
		private readonly puzzleShareRecipientRepository: PuzzleShareRecipientRepository,
		private readonly presentPuzzleSharesUseCase: PresentPuzzleSharesUseCase,
	) {}

	/** What reached the caller. The addressing row is the list; the challenge hangs off it. */
	async listReceived(user: User): Promise<PuzzleShareResponse[]> {
		const rows = await this.puzzleShareRecipientRepository.getManyByRecipient(
			user.uuid,
			DEFAULT_LIMIT,
		);

		return this.presentPuzzleSharesUseCase.execute(rows.map((row) => row.share));
	}

	async listSent(user: User): Promise<PuzzleShareResponse[]> {
		const shares = await this.puzzleShareRepository.getManyBySender(user.uuid, DEFAULT_LIMIT);

		return this.presentPuzzleSharesUseCase.execute(shares);
	}
}
