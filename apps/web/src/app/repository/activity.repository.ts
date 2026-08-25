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

	/** Both ends are included, and the range runs over the key itself: no index needed. */
	async findRange(from: string, to: string): Promise<ActivityDayRow[]> {
		return this.runInTransaction(['activityDay'], 'readonly', (transaction) =>
			transaction.objectStore('activityDay').getAll(IDBKeyRange.bound(from, to)),
		);
	}

	/** How many days of the range are stored, which against its size reveals the gaps. */
	async countRange(from: string, to: string): Promise<number> {
		return this.runInTransaction(['activityDay'], 'readonly', (transaction) =>
			transaction.objectStore('activityDay').count(IDBKeyRange.bound(from, to)),
		);
	}

	/** The oldest day stored, where the run that has to be kept current begins. */
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
