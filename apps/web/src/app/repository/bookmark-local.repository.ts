import { Injectable } from '@angular/core';

import { BookmarkRow, BookmarkSchema } from '@app/repository/definition/bookmark-schema.interface';
import { GenericRepository } from '@app/repository/generic.repository';
import { isSameVersion } from '@app/util/bookmark-merge';

export interface BookmarkReplacement {
	readonly expected: BookmarkRow | undefined;
	readonly next: BookmarkRow;
}

@Injectable({
	providedIn: 'root',
})
export class BookmarkLocalRepository extends GenericRepository<BookmarkSchema> {
	async readAll(): Promise<BookmarkRow[]> {
		return this.findAll('bookmark');
	}

	async save(row: BookmarkRow): Promise<BookmarkRow> {
		return this.insert('bookmark', row);
	}

	async update(
		lichessId: string,
		change: (current: BookmarkRow) => BookmarkRow,
	): Promise<BookmarkRow | undefined> {
		return this.runInTransaction(['bookmark'], 'readwrite', async (transaction) => {
			const store = transaction.objectStore('bookmark');
			const current = await store.get(lichessId);

			if (undefined === current) {
				return undefined;
			}

			const next = change(current);

			await store.put(next);

			return next;
		});
	}

	async replaceAll(replacements: readonly BookmarkReplacement[]): Promise<void> {
		await this.runInTransaction(['bookmark'], 'readwrite', async (transaction) => {
			const store = transaction.objectStore('bookmark');

			for (const { expected, next } of replacements) {
				if (isSameVersion(await store.get(next.lichessId), expected)) {
					await store.put(next);
				}
			}
		});
	}

	async remove(lichessId: string): Promise<void> {
		await this.delete('bookmark', lichessId);
	}
}
