import { Injectable } from '@nestjs/common';

import { NotFoundException } from '../../../shared/exception/not-found.exception';
import { User } from '../../user/user.entity';
import { PuzzleShareRecipientRepository } from '../puzzle-share-recipient.repository';
import { PuzzleShare } from '../puzzle-share.entity';
import { PuzzleShareRepository } from '../puzzle-share.repository';

/**
 * A challenge, guarded by taking part in it. Somebody outside gets a 404 and not a 403: it
 * is not theirs to know exists.
 */
@Injectable()
export class GetPuzzleShareUseCase {
	constructor(
		private readonly puzzleShareRepository: PuzzleShareRepository,
		private readonly puzzleShareRecipientRepository: PuzzleShareRecipientRepository,
	) {}

	async execute(user: User, uuid: string): Promise<PuzzleShare> {
		const share = await this.puzzleShareRepository.getOne(
			{ uuid },
			{ populate: ['puzzle', 'sender'] },
		);

		if (share.sender.uuid === user.uuid) {
			return share;
		}

		const rows = await this.puzzleShareRecipientRepository.getMany(
			{ share: share.uuid, recipient: user.uuid },
			{ limit: 1 },
		);

		if (0 === rows.length) {
			throw new NotFoundException('not exists', 'puzzleshare');
		}

		return share;
	}
}
