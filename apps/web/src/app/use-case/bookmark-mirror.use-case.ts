import { Injectable, inject } from '@angular/core';
import type { PuzzleBookmarkType } from '@chesspecker/api-definitions';

import { BookmarkLocalRepository } from '@app/repository/bookmark-local.repository';
import { BookmarkRow } from '@app/repository/definition/bookmark-schema.interface';
import { PuzzleBookmarkRepository } from '@app/repository/puzzle-bookmark.repository';
import { SessionStore } from '@app/store/session.store';
import { mergeBookmarks } from '@app/util/bookmark-merge';

/**
 * The two sides of a bookmark: this device, which always answers, and the account, which
 * answers when there is a session and a trip. Everything is written here first, so filing
 * an exercise offline is not a lesser thing than filing it online.
 */
@Injectable({
	providedIn: 'root',
})
export class BookmarkMirrorUseCase {
	private readonly localRepository = inject(BookmarkLocalRepository);
	private readonly remoteRepository = inject(PuzzleBookmarkRepository);
	private readonly sessionStore = inject(SessionStore);

	async read(): Promise<readonly BookmarkRow[]> {
		return this.localRepository.readAll();
	}

	/** Writes the row here and hands back what the device holds afterwards, pushed or not. */
	async file(
		lichessId: string,
		current: BookmarkRow | undefined,
		type: PuzzleBookmarkType,
	): Promise<BookmarkRow> {
		const now = new Date();
		// Built from scratch rather than spread over the old row: re-filing an exercise that
		// was unfiled has to leave the tombstone behind, not carry it along.
		const row: BookmarkRow = {
			lichessId,
			type,
			createdAt: current?.createdAt ?? now,
			updatedAt: now,
		};

		await this.localRepository.save(row);

		return (await this.push(row)) ?? row;
	}

	/**
	 * A row the account never saw simply leaves. One it acknowledged stays behind as a
	 * tombstone until the removal has travelled, or the next pull would file it again.
	 */
	async unfile(current: BookmarkRow): Promise<void> {
		if (undefined === current.syncedAt) {
			await this.localRepository.remove(current.lichessId);

			return;
		}

		const now = new Date();
		const tombstone: BookmarkRow = { ...current, updatedAt: now, removedAt: now };

		await this.localRepository.save(tombstone);
		await this.push(tombstone);
	}

	/**
	 * Brings the account's lists down, settles them against this device and writes the
	 * outcome. What comes back is read from the store afterwards rather than assembled from
	 * the three moves, so a row nothing had to be done to is not lost on the way out.
	 */
	async pull(): Promise<readonly BookmarkRow[]> {
		const local = await this.localRepository.readAll();
		const { save, drop, push } = mergeBookmarks(local, await this.remoteRepository.list());

		await this.localRepository.saveAll(save);
		await Promise.all(drop.map((lichessId) => this.localRepository.remove(lichessId)));
		await Promise.all(push.map((row) => this.push(row)));

		return this.localRepository.readAll();
	}

	/**
	 * One row up. A trip that does not happen is not a failure: the row keeps its unsynced
	 * mark and the next pull takes it, which is what an offline device needs.
	 */
	private async push(row: BookmarkRow): Promise<BookmarkRow | null> {
		if (!this.sessionStore.isAuthenticated()) {
			return undefined === row.removedAt ? row : null;
		}

		try {
			return await this.send(row);
		} catch {
			return row;
		}
	}

	private async send(row: BookmarkRow): Promise<BookmarkRow | null> {
		if (undefined !== row.removedAt) {
			await this.remoteRepository.remove(row.lichessId);
			await this.localRepository.remove(row.lichessId);

			return null;
		}

		const sealed: BookmarkRow = { ...row, syncedAt: row.updatedAt };

		await this.remoteRepository.upsert(row.lichessId, row.type, row.updatedAt);
		await this.localRepository.save(sealed);

		return sealed;
	}
}
