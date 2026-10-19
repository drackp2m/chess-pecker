import { Injectable, effect, inject } from '@angular/core';
import { patchState, signalStore, type, withState } from '@ngrx/signals';
import { entityConfig, setAllEntities, setEntity, withEntities } from '@ngrx/signals/entities';

import type { TranslationRef } from '@app/definition/i18n.type';
import { I18n, i18nRef } from '@app/i18n';
import { Setting } from '@app/model/setting.model';
import { SettingRepository } from '@app/repository/setting.repository';
import { NotificationService } from '@app/service/notification.service';
import { SessionStore } from '@app/store/session.store';
import { SettingMirrorUseCase } from '@app/use-case/setting-mirror.use-case';

interface SettingStoreProps {
	isLoading: boolean;
	error: TranslationRef | null;
	arrived: readonly Setting[] | null;
}

const initialState: SettingStoreProps = {
	isLoading: false,
	error: null,
	arrived: null,
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
	private readonly sessionStore = inject(SessionStore);
	private readonly mirror = inject(SettingMirrorUseCase);

	private loaded: Promise<void> = Promise.resolve();

	constructor() {
		super();

		this.watchBlockedUpgrade();
		this.fetchData();
		this.watchSession();
	}

	/**
	 * An upsert keyed by `type`, replacing the entity outright. Deliberately not
	 * `updateEntity`, which merges into a literal and drops the `Setting` prototype.
	 */
	save(item: Setting): void {
		void this.settingRepository
			.insert('setting', item)
			.then((saved) => {
				patchState(this, setEntity(saved, settingConfig), { error: null });

				void this.push(saved);
			})
			.catch((error: unknown) => {
				console.error(`Could not save the \`${item.type}\` setting`, error);

				this.notificationService.notify(SAVE_ERROR_MESSAGE);
				patchState(this, { error: SAVE_ERROR_MESSAGE });
			});
	}

	private async push(setting: Setting): Promise<void> {
		const stored = await this.mirror.push(setting);

		if (null === stored) {
			return;
		}

		patchState(this, setEntity(stored, settingConfig));

		if (stored.updatedAt.getTime() > setting.updatedAt.getTime()) {
			patchState(this, { arrived: this.settingEntities() });
		}
	}

	private watchSession(): void {
		let isMirrored = false;

		effect(() => {
			if (!this.sessionStore.isAuthenticated()) {
				isMirrored = false;

				return;
			}

			if (!isMirrored) {
				isMirrored = true;

				void this.pull();
			}
		});
	}

	private async pull(): Promise<void> {
		try {
			await this.loaded;

			const { rows, isChanged } = await this.mirror.pull();

			patchState(
				this,
				setAllEntities([...rows], settingConfig),
				isChanged ? { arrived: rows } : {},
			);
		} catch (error: unknown) {
			console.error('Could not mirror the stored settings', error);
		}
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

		this.loaded = this.settingRepository
			.findAll('setting')
			.then((items) => {
				patchState(this, setAllEntities(items, settingConfig), { arrived: items });
			})
			.catch((error: unknown) => {
				console.error('Could not load the stored settings', error);

				this.notificationService.notify(LOAD_ERROR_MESSAGE);
				patchState(this, { error: LOAD_ERROR_MESSAGE, arrived: [] });
			})
			.finally(() => {
				patchState(this, { isLoading: false });
			});
	}
}
