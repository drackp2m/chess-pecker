import { Injectable, inject } from '@angular/core';
import type { PuzzleBookmarkType } from '@chesspecker/api-definitions';

import { AttemptRepository } from '@app/repository/attempt.repository';
import { BookmarkLocalRepository } from '@app/repository/bookmark-local.repository';
import {
	BookmarkHistoryRow,
	BookmarkRow,
} from '@app/repository/definition/bookmark-schema.interface';
import { PuzzleBookmarkRepository } from '@app/repository/puzzle-bookmark.repository';
import { SessionStore } from '@app/store/session.store';
import { isPending, mergeBookmarks } from '@app/util/bookmark-merge';

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
	private readonly attemptRepository = inject(AttemptRepository);
	private readonly remoteRepository = inject(PuzzleBookmarkRepository);
	private readonly sessionStore = inject(SessionStore);

	async read(): Promise<readonly BookmarkRow[]> {
		const rows = await this.localRepository.readAll();

		return this.backfill(rows);
	}

	async hasPending(): Promise<boolean> {
		return (await this.localRepository.readAll()).some(isPending);
	}

	async push(): Promise<void> {
		const rows = await this.localRepository.readAll();

		for (const row of rows) {
			if (isPending(row)) {
				await this.pushRow(row);
			}
		}
	}

	/** Writes the row here and hands back what the device holds afterwards, pushed or not. */
	async file(
		lichessId: string,
		current: BookmarkRow | undefined,
		type: PuzzleBookmarkType,
		attemptUuid?: string,
	): Promise<BookmarkRow> {
		const now = new Date();
		// Built from scratch rather than spread over the old row: re-filing an exercise that
		// was unfiled has to leave the tombstone behind, not carry it along.
		const row: BookmarkRow = {
			lichessId,
			type,
			...(undefined === attemptUuid ? {} : { attemptUuid }),
			createdAt: current?.createdAt ?? now,
			updatedAt: now,
			history: [...(current?.history ?? []), this.event(type, now, attemptUuid)],
		};

		await this.localRepository.save(row);

		return (await this.pushRow(row)) ?? row;
	}

	/**
	 * A row the account never saw simply leaves. One it acknowledged stays behind as a
	 * tombstone until the removal has travelled, or the next pull would file it again.
	 */
	async unfile(current: BookmarkRow, attemptUuid?: string): Promise<void> {
		if (undefined === current.syncedAt) {
			const now = new Date();
			const tombstone: BookmarkRow = {
				...current,
				updatedAt: now,
				history: [...(current.history ?? []), this.event(null, now, attemptUuid)],
				removedAt: now,
			};
			await this.localRepository.save(tombstone);

			await this.pushRow(tombstone);

			return;
		}

		const now = new Date();
		const tombstone: BookmarkRow = {
			...current,
			updatedAt: now,
			removedAt: now,
			history: [...(current.history ?? []), this.event(null, now, attemptUuid)],
		};

		await this.localRepository.save(tombstone);
		await this.pushRow(tombstone);
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
		await Promise.all(
			drop.map(async (lichessId) => {
				const row = local.find((candidate) => candidate.lichessId === lichessId);

				if (undefined !== row) {
					await this.localRepository.save({ ...row, removedAt: row.updatedAt });
				}
			}),
		);
		await Promise.all(push.map((row) => this.pushRow(row)));

		return this.localRepository.readAll();
	}

	/**
	 * One row up. A trip that does not happen is not a failure: the row keeps its unsynced
	 * mark and the next pull takes it, which is what an offline device needs.
	 */
	private async pushRow(row: BookmarkRow): Promise<BookmarkRow | null> {
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
		let synced = row;
		const history = row.history ?? [];

		if (0 === history.length) {
			await this.sendCurrent(row);
		}

		for (const event of history) {
			if (undefined !== event.syncedAt) {
				continue;
			}

			await this.sendEvent(row.lichessId, event);

			synced = Object.assign({}, synced, {
				history: (synced.history ?? []).map((candidate) =>
					candidate.uuid === event.uuid ? { ...candidate, syncedAt: event.createdAt } : candidate,
				),
			});
			await this.localRepository.save(synced);
		}

		const sealed = { ...synced, syncedAt: synced.updatedAt };
		await this.localRepository.save(sealed);

		return sealed;
	}

	private sendCurrent(row: BookmarkRow): Promise<void> {
		return undefined === row.removedAt
			? this.remoteRepository
					.upsert(row.lichessId, row.type, row.updatedAt, undefined, row.attemptUuid)
					.then(() => undefined)
			: this.remoteRepository.remove(row.lichessId, undefined, row.attemptUuid, row.updatedAt);
	}

	private async sendEvent(lichessId: string, event: BookmarkHistoryRow): Promise<void> {
		if (null === event.type) {
			await this.remoteRepository.remove(lichessId, event.uuid, event.attemptUuid, event.createdAt);

			return;
		}

		await this.remoteRepository.upsert(
			lichessId,
			event.type,
			event.createdAt,
			event.uuid,
			event.attemptUuid,
		);
	}

	private async backfill(rows: readonly BookmarkRow[]): Promise<readonly BookmarkRow[]> {
		const updated: BookmarkRow[] = [];

		for (const row of rows) {
			if (undefined !== row.history) {
				updated.push(row);

				continue;
			}

			const attempt = await this.attemptRepository.findNearestBefore(row.lichessId, row.updatedAt);
			const event = this.event(row.type, row.updatedAt, attempt?.uuid);
			const backfilled = { ...row, history: [event] };

			await this.localRepository.save(backfilled);
			updated.push(backfilled);
		}

		return updated;
	}

	private event(
		type: BookmarkRow['type'] | null,
		createdAt: Date,
		attemptUuid?: string,
	): BookmarkHistoryRow {
		return {
			uuid: crypto.randomUUID(),
			type,
			createdAt,
			...(undefined === attemptUuid ? {} : { attemptUuid }),
		};
	}
}
