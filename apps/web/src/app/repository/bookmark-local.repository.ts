import { Injectable } from '@angular/core';

import { BookmarkRow, BookmarkSchema } from '@app/repository/definition/bookmark-schema.interface';
import { GenericRepository } from '@app/repository/generic.repository';

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

	async saveAll(rows: readonly BookmarkRow[]): Promise<void> {
		await this.batchInsert('bookmark', [...rows]);
	}

	async remove(lichessId: string): Promise<void> {
		await this.delete('bookmark', lichessId);
	}
}
