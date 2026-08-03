import { Injectable, inject } from '@angular/core';
import { patchState, signalStore, type, withState } from '@ngrx/signals';
import { entityConfig, setAllEntities, setEntity, withEntities } from '@ngrx/signals/entities';

import { Setting } from '@app/model/setting.model';
import { SettingRepository } from '@app/repository/setting.repository';

interface SettingStoreProps {
	isLoading: boolean;
	error: string | null;
}

const initialState: SettingStoreProps = {
	isLoading: false,
	error: null,
};

const settingConfig = entityConfig({
	entity: type<Setting>(),
	collection: 'setting',
	selectId: (setting) => setting.type,
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

	/**
	 * Writes the setting and replaces the stored entity outright — `type` is the key on
	 * both sides, so this is an upsert and creating a setting is the same call as
	 * changing it. Deliberately not `updateEntity`: that one merges into a fresh object
	 * literal (`{ ...entity, ...changes }`), which drops the `Setting` prototype and
	 * leaves `settingEntities()` typed as `Setting[]` while holding plain data with no
	 * `.with()` on it. `setEntity` keeps the instance, and callers always pass a whole
	 * `Setting` here anyway, so there is nothing to merge.
	 */
	save(item: Setting): void {
		void this.settingRepository
			.insert('setting', item)
			.then((saved) => {
				patchState(this, setEntity(saved, settingConfig), { error: null });
			})
			.catch((error: unknown) => {
				console.error(`Could not save the \`${item.type}\` setting`, error);

				patchState(this, { error: 'The setting could not be saved.' });
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
