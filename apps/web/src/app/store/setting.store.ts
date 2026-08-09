import { Injectable, effect, inject } from '@angular/core';
import { patchState, signalStore, type, withState } from '@ngrx/signals';
import { entityConfig, setAllEntities, setEntity, withEntities } from '@ngrx/signals/entities';

import type { TranslationRef } from '@app/definition/i18n.type';
import { I18n, i18nRef } from '@app/i18n';
import { Setting } from '@app/model/setting.model';
import { SettingRepository } from '@app/repository/setting.repository';
import { NotificationService } from '@app/service/notification.service';

interface SettingStoreProps {
	isLoading: boolean;
	error: TranslationRef | null;
}

const initialState: SettingStoreProps = {
	isLoading: false,
	error: null,
};

const LOAD_ERROR_MESSAGE = i18nRef(I18n.common.SETTINGS_LOAD_ERROR);
const SAVE_ERROR_MESSAGE = i18nRef(I18n.common.SETTINGS_SAVE_ERROR);
const BLOCKED_UPGRADE_MESSAGE = i18nRef(I18n.common.SETTINGS_BLOCKED_UPGRADE);

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
	private readonly notificationService = inject(NotificationService);

	constructor() {
		super();

		this.watchBlockedUpgrade();
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

				this.notificationService.notify(SAVE_ERROR_MESSAGE);
				patchState(this, { error: SAVE_ERROR_MESSAGE });
			});
	}

	private watchBlockedUpgrade(): void {
		let notificationUuid: string | null = null;

		effect(() => {
			if (this.settingRepository.isUpgradeBlocked()) {
				notificationUuid ??= this.notificationService.notify(BLOCKED_UPGRADE_MESSAGE, {
					timeout: null,
				});

				return;
			}

			if (null !== notificationUuid) {
				this.notificationService.dismiss(notificationUuid);

				notificationUuid = null;
			}
		});
	}

	private fetchData(): void {
		patchState(this, { isLoading: true });

		void this.settingRepository
			.findAll('setting')
			.then((items) => {
				patchState(this, setAllEntities(items, settingConfig));
			})
			.catch((error: unknown) => {
				console.error('Could not load the stored settings', error);

				this.notificationService.notify(LOAD_ERROR_MESSAGE);
				patchState(this, { error: LOAD_ERROR_MESSAGE });
			})
			.finally(() => {
				patchState(this, { isLoading: false });
			});
	}
}
