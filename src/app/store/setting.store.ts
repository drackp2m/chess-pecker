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

	// FixMe => `updateEntity` stores `{ ...entity, ...changes }`, so the `Setting`
	// prototype is lost on the first update and `settingEntities()` silently stops
	// matching its own type: `.with()` and `.toObject()` are gone while TypeScript
	// still reports `Setting[]`. It is why `ThemeService` needs a try/catch and why
	// `BoardPreferenceService.store()` throws on the third change of one setting.
	// Pick one: keep models as plain immutable data with free functions, or rehydrate
	// on read (`computed(() => entities.map((item) => new Setting(item)))`).
	//
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

	update(item: Setting): void {
		void this.settingRepository.insert('setting', item).then((item) => {
			patchState(this, updateEntity({ id: item.uuid, changes: item }, settingConfig));
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
