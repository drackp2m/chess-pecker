import { Injectable, inject } from '@angular/core';

import {
	ActivityDayRow,
	ActivitySchema,
} from '@app/repository/definition/activity-schema.interface';
import { GenericRepository } from '@app/repository/generic.repository';
import { SyncCursorRepository } from '@app/repository/sync-cursor.repository';

@Injectable({
	providedIn: 'root',
})
export class ActivityRepository extends GenericRepository<ActivitySchema> {
	private readonly cursors = inject(SyncCursorRepository);

	/** Ambos extremos entran, y el rango va sobre la propia clave: no hace falta índice. */
	async findRange(from: string, to: string): Promise<ActivityDayRow[]> {
		return this.runInTransaction(['activityDay'], 'readonly', (transaction) =>
			transaction.objectStore('activityDay').getAll(IDBKeyRange.bound(from, to)),
		);
	}

	/** Cuántos días del rango hay guardados, que comparado con su tamaño delata los huecos. */
	async countRange(from: string, to: string): Promise<number> {
		return this.runInTransaction(['activityDay'], 'readonly', (transaction) =>
			transaction.objectStore('activityDay').count(IDBKeyRange.bound(from, to)),
		);
	}

	/** El día más antiguo guardado, que es donde empieza el tramo que hay que mantener. */
	async firstDate(): Promise<string | undefined> {
		const keys = await this.runInTransaction(['activityDay'], 'readonly', (transaction) =>
			transaction.objectStore('activityDay').getAllKeys(undefined, 1),
		);

		return keys[0];
	}

	async saveAll(rows: ActivityDayRow[]): Promise<void> {
		await this.batchInsert('activityDay', rows);
	}

	async findCursor(): Promise<string | null> {
		return (await this.cursors.findCursor('activity'))?.cursor ?? null;
	}

	async saveCursor(cursor: string): Promise<void> {
		await this.cursors.saveCursor('activity', { cursor });
	}
}
