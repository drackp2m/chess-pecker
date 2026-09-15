import { Injectable } from '@angular/core';

import { AppSchema } from '@app/repository/definition/app-schema.interface';
import { AttemptRow } from '@app/repository/definition/attempt-schema.interface';
import { GenericRepository } from '@app/repository/generic.repository';

@Injectable({
	providedIn: 'root',
})
export class AttemptRepository extends GenericRepository<AppSchema> {
	async findNearestBefore(lichessId: string, at: Date): Promise<AttemptRow | undefined> {
		const attempts = await this.findAll('attempt');

		return attempts
			.filter((attempt) => attempt.lichessId === lichessId && attempt.updatedAt <= at)
			.sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime())[0];
	}

	findRangeByUpdatedAt(from: Date, to: Date): Promise<AttemptRow[]> {
		return this.findAllByIndex('attempt', 'updatedAt', IDBKeyRange.bound(from, to));
	}

	countRangeByUpdatedAt(from: Date, to: Date): Promise<number> {
		return this.countByIndex('attempt', 'updatedAt', IDBKeyRange.bound(from, to));
	}
}
