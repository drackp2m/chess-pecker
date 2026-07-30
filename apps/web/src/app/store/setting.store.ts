import { Injectable, inject } from '@angular/core';
import { patchState, signalStore, type, withState } from '@ngrx/signals';
import {
	addEntity,
	entityConfig,
	setAllEntities,
	setEntity,
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

	// FixMe => neither writer handles rejection. `insert` failing leaves the store
	// showing a value that was never persisted, and `void ... .then()` with no
	// `.catch()` surfaces as an unhandled rejection.
	//
	// FixMe => read-modify-write race: `add()` is chosen by reading `settingEntities()`
	// before the previous insert resolved, so two quick changes to the same setting
	// create two rows with different uuids and the same `type`. The `type` index is
	// `unique: true`, so the second `put` aborts the transaction. Making `type` the
	// key path (one row per setting, no uuid) removes the race entirely.
	add(item: Setting): void {
		void this.settingRepository.insert('setting', item).then((item) => {
			patchState(this, addEntity(item, settingConfig));
		});
	}

	/**
	 * Replaces the stored entity outright. Deliberately not `updateEntity`: that one
	 * merges into a fresh object literal (`{ ...entity, ...changes }`), which drops the
	 * `Setting` prototype and leaves `settingEntities()` typed as `Setting[]` while
	 * holding plain data with no `.with()` on it. `setEntity` keeps the instance, and
	 * callers always pass a whole `Setting` here anyway, so there is nothing to merge.
	 */
	update(item: Setting): void {
		void this.settingRepository.insert('setting', item).then((item) => {
			patchState(this, setEntity(item, settingConfig));
		});
	}

	// FixMe => a rejected `findAll` (blocked upgrade, private-browsing quota, corrupt
	// database) leaves `isLoading` true forever. Every consumer gates on it with an
	// `effect` that returns early while loading, so the theme, the board preferences
	// and the update check all stay silently unapplied with no error shown.
	private fetchData(): void {
		patchState(this, { isLoading: true });

		void this.settingRepository.findAll('setting').then((items) => {
			patchState(this, setAllEntities(items, settingConfig));
			patchState(this, { isLoading: false });
		});
	}
}
