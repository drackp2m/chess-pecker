import type { PuzzleShare as PuzzleShareResponse } from '@chesspecker/api-definitions';
import { Injectable } from '@nestjs/common';

import { PuzzleShareAttemptRepository } from '../puzzle-share-attempt.repository';
import { PuzzleShareRecipientRepository } from '../puzzle-share-recipient.repository';
import { PuzzleShare } from '../puzzle-share.entity';
import { presentShare } from '../util/puzzle-share.util';

function groupByShare<T extends { share: { uuid: string } }>(rows: readonly T[]): Map<string, T[]> {
	const grouped = new Map<string, T[]>();

	for (const row of rows) {
		const bucket = grouped.get(row.share.uuid) ?? [];

		bucket.push(row);
		grouped.set(row.share.uuid, bucket);
	}

	return grouped;
}

/**
 * Fills a batch of challenges out: two queries for the whole page, whatever its length, so
 * listing twenty of them does not cost forty round trips.
 */
@Injectable()
export class PresentPuzzleSharesUseCase {
	constructor(
		private readonly puzzleShareRecipientRepository: PuzzleShareRecipientRepository,
		private readonly puzzleShareAttemptRepository: PuzzleShareAttemptRepository,
	) {}

	async execute(shares: readonly PuzzleShare[]): Promise<PuzzleShareResponse[]> {
		const uuids = shares.map((share) => share.uuid);
		const [recipients, attempts] = await Promise.all([
			this.puzzleShareRecipientRepository.getManyByShares(uuids),
			this.puzzleShareAttemptRepository.getManyByShares(uuids),
		]);

		const recipientsByShare = groupByShare(recipients);
		const attemptsByShare = groupByShare(attempts);

		return shares.map((share) =>
			presentShare(
				share,
				recipientsByShare.get(share.uuid) ?? [],
				attemptsByShare.get(share.uuid) ?? [],
			),
		);
	}

	async executeOne(share: PuzzleShare): Promise<PuzzleShareResponse> {
		const [presented] = await this.execute([share]);

		return presented ?? presentShare(share, [], []);
	}
}
