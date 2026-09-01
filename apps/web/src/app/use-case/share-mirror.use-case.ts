import { Injectable, inject } from '@angular/core';
import type { PuzzleShare, SyncEntitySummary } from '@chesspecker/api-definitions';

import { ShareRow } from '@app/repository/definition/share-schema.interface';
import { SyncCursorRow } from '@app/repository/definition/sync-cursor-schema.interface';
import { PuzzleShareRepository } from '@app/repository/puzzle-share.repository';
import { ShareLocalRepository } from '@app/repository/share-local.repository';
import { SyncCursorRepository } from '@app/repository/sync-cursor.repository';

/** A page of the feed. Small on purpose: a challenge carries everyone who is in it. */
const PAGE_SIZE = 50;

/** A feed that never advances is a feed that would be walked for ever. */
const MAX_PAGES = 40;

export function toShareRow(share: PuzzleShare): ShareRow {
	return {
		uuid: share.uuid,
		lichessId: share.lichessId,
		message: share.message,
		sender: share.sender,
		recipients: share.recipients,
		createdAt: new Date(share.createdAt),
		updatedAt: new Date(share.updatedAt),
	};
}

/**
 * The copy of what this account has sent. It only ever comes down: challenges are the one
 * thing whose home is the API and not the device, so there is nothing to push and nothing
 * to lose by logging out. The copy is here so a finished exercise can say it was already
 * shared, and how it went, without a trip.
 */
@Injectable({
	providedIn: 'root',
})
export class ShareMirrorUseCase {
	private readonly localRepository = inject(ShareLocalRepository);
	private readonly remoteRepository = inject(PuzzleShareRepository);
	private readonly cursors = inject(SyncCursorRepository);

	async read(): Promise<readonly ShareRow[]> {
		return this.localRepository.readAll();
	}

	/** What was just sent, written down before the next pass would have brought it back. */
	async record(share: PuzzleShare): Promise<ShareRow> {
		return this.localRepository.save(toShareRow(share));
	}

	/**
	 * Brings down whatever the copy is missing and answers whether anything changed. The
	 * summary is what decides: matching stamp and count means there is nothing to ask for,
	 * and the pass costs no trip at all.
	 */
	async pull(summary: SyncEntitySummary): Promise<boolean> {
		const stored = await this.cursors.findCursor('share');

		if (!isBehind(stored, summary)) {
			return false;
		}

		const written = await this.walk(stored?.cursor ?? undefined);

		await this.cursors.saveCursor('share', { cursor: summary.cursor, count: summary.count });

		return 0 < written;
	}

	/**
	 * The feed, page by page, from where the copy stopped. The server answers `>=` the stamp,
	 * so the row the last page ended on comes back once more: writing it again costs nothing
	 * and keeps two challenges sharing a millisecond from falling through the gap.
	 */
	private async walk(since: string | undefined): Promise<number> {
		let cursor = since;
		let written = 0;

		for (let page = 0; page < MAX_PAGES; page += 1) {
			const shares = await this.remoteRepository.listSent({
				...(undefined === cursor ? {} : { since: cursor }),
				limit: PAGE_SIZE,
			});

			if (0 === shares.length) {
				return written;
			}

			await this.localRepository.saveAll(shares.map(toShareRow));
			written += shares.length;

			const last = shares[shares.length - 1]?.updatedAt;

			// A whole page under one stamp cannot be walked past without reading it twice for
			// ever: the copy takes what it got and waits for the next challenge to move it on.
			if (shares.length < PAGE_SIZE || undefined === last || last === cursor) {
				return written;
			}

			cursor = last;
		}

		return written;
	}
}

/**
 * Matching stamp and count means current, as everywhere else: a `MAX` cannot see a challenge
 * that left, and a count alone cannot see an answer that moved one.
 */
function isBehind(local: SyncCursorRow | undefined, remote: SyncEntitySummary): boolean {
	if (null === remote.cursor && 0 === remote.count) {
		return false;
	}

	return (local?.cursor ?? null) !== remote.cursor || (local?.count ?? 0) !== remote.count;
}
