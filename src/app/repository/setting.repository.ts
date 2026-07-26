import { Injectable } from '@angular/core';
import { StoreNames, StoreValue } from 'idb';

import { Setting } from '@app/model/setting.model';
import { SettingSchema } from '@app/repository/definition/setting-schema.interface';
import { GenericRepository } from '@app/repository/generic.repository';

@Injectable()
export class SettingRepository extends GenericRepository<SettingSchema> {
	override async findAll<K extends StoreNames<SettingSchema>>(
		storeName: K,
	): Promise<StoreValue<SettingSchema, K>[]> {
		return await super.findAll(storeName).then((items) => items.map((item) => new Setting(item)));
	}
}
