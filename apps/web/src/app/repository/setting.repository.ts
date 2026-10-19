import { Injectable } from '@angular/core';
import { StoreNames, StoreValue } from 'idb';

import { Setting } from '@app/model/setting.model';
import { SettingSchema } from '@app/repository/definition/setting-schema.interface';
import { GenericRepository } from '@app/repository/generic.repository';

@Injectable()
export class SettingRepository extends GenericRepository<SettingSchema> {
	async replace(expected: Setting | undefined, next: Setting): Promise<Setting | null> {
		return this.runInTransaction(['setting'], 'readwrite', async (transaction) => {
			const store = transaction.objectStore('setting');
			const current = await store.get(next.type);

			if (current?.updatedAt.getTime() !== expected?.updatedAt.getTime()) {
				return null;
			}

			await store.put(next);

			return next;
		});
	}

	/** Covers every read path, not just `findAll`, so no caller ever sees plain data. */
	protected override hydrate<K extends StoreNames<SettingSchema>>(
		_storeName: K,
		value: StoreValue<SettingSchema, K>,
	): StoreValue<SettingSchema, K> {
		return new Setting(value);
	}
}
