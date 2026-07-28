import { Injectable } from '@angular/core';
import { StoreNames, StoreValue } from 'idb';

import { Setting } from '@app/model/setting.model';
import { SettingSchema } from '@app/repository/definition/setting-schema.interface';
import { GenericRepository } from '@app/repository/generic.repository';

@Injectable()
export class SettingRepository extends GenericRepository<SettingSchema> {
	/** Covers every read path, not just `findAll`, so no caller ever sees plain data. */
	protected override hydrate<K extends StoreNames<SettingSchema>>(
		_storeName: K,
		value: StoreValue<SettingSchema, K>,
	): StoreValue<SettingSchema, K> {
		return new Setting(value);
	}
}
