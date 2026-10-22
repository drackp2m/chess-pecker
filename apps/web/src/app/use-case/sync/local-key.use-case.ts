import { Injectable, inject } from '@angular/core';
import type { SyncEntity } from '@chesspecker/api-definitions';

import { AppSchema } from '@app/repository/definition/app-schema.interface';
import { PendingStore } from '@app/repository/definition/pending-schema.interface';
import { RepositoryTransaction } from '@app/repository/generic.repository';
import { LocalDataRepository } from '@app/repository/local-data.repository';

export async function currentKey<M extends 'readonly' | 'readwrite'>(
	transaction: RepositoryTransaction<AppSchema, M>,
	entity: SyncEntity,
	uuid: string,
): Promise<string> {
	const store = transaction.objectStore(entity) as unknown as PendingStore<M>;

	if (undefined !== (await store.getKey(uuid))) {
		return uuid;
	}

	return (await store.index('clientRef').getKey(uuid)) ?? uuid;
}

@Injectable({
	providedIn: 'root',
})
export class LocalKeyUseCase {
	private readonly repository = inject(LocalDataRepository);

	current(entity: SyncEntity, uuid: string): Promise<string> {
		return this.repository.runInTransaction([entity], 'readonly', (transaction) =>
			currentKey(transaction, entity, uuid),
		);
	}
}
