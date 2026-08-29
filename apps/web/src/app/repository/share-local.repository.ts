import { Injectable } from '@angular/core';

import { ShareRow, ShareSchema } from '@app/repository/definition/share-schema.interface';
import { GenericRepository } from '@app/repository/generic.repository';

@Injectable({
	providedIn: 'root',
})
export class ShareLocalRepository extends GenericRepository<ShareSchema> {
	async readAll(): Promise<ShareRow[]> {
		return this.findAll('share');
	}

	async readByPuzzle(lichessId: string): Promise<ShareRow[]> {
		return this.findAllByIndex('share', 'lichessId', lichessId);
	}

	async save(row: ShareRow): Promise<ShareRow> {
		return this.insert('share', row);
	}

	async saveAll(rows: readonly ShareRow[]): Promise<void> {
		await this.batchInsert('share', [...rows]);
	}
}
