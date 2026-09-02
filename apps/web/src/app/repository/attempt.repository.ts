import { Injectable } from '@angular/core';

import { AppSchema } from '@app/repository/definition/app-schema.interface';
import { AttemptRow } from '@app/repository/definition/attempt-schema.interface';
import { GenericRepository } from '@app/repository/generic.repository';

@Injectable({
	providedIn: 'root',
})
export class AttemptRepository extends GenericRepository<AppSchema> {
	findRangeByUpdatedAt(from: Date, to: Date): Promise<AttemptRow[]> {
		return this.findAllByIndex('attempt', 'updatedAt', IDBKeyRange.bound(from, to));
	}

	countRangeByUpdatedAt(from: Date, to: Date): Promise<number> {
		return this.countByIndex('attempt', 'updatedAt', IDBKeyRange.bound(from, to));
	}
}
