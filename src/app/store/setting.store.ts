import { Injectable, inject } from '@angular/core';
import { patchState, signalStore, type, withState } from '@ngrx/signals';
import {
	addEntity,
	entityConfig,
	setAllEntities,
	updateEntity,
	withEntities,
} from '@ngrx/signals/entities';

import { Setting } from '@app/model/setting.model';
import { SettingRepository } from '@app/repository/setting.repository';

interface SettingStoreProps {
	isLoading: boolean;
}

const initialState: SettingStoreProps = {
	isLoading: false,
};

const settingConfig = entityConfig({
	entity: type<Setting>(),
	collection: 'setting',
	selectId: (setting) => setting.uuid,
});

@Injectable({
	providedIn: 'root',
})
export class SettingStore extends signalStore(
	{ protectedState: false },
	withState(initialState),
	withEntities(settingConfig),
) {
	private readonly settingRepository = inject(SettingRepository);

	constructor() {
		super();

		this.fetchData();
	}

	add(item: Setting): void {
		void this.settingRepository.insert('setting', item).then((item) => {
			patchState(this, addEntity(item, settingConfig));
		});
	}

	update(item: Setting): void {
		void this.settingRepository.insert('setting', item).then((item) => {
			patchState(this, updateEntity({ id: item.uuid, changes: item }, settingConfig));
		});
	}

	private fetchData(): void {
		patchState(this, { isLoading: true });

		void this.settingRepository.findAll('setting').then((items) => {
			patchState(this, setAllEntities(items, settingConfig));
			patchState(this, { isLoading: false });
		});
	}
}
