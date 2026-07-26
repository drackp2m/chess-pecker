import { ApplicationRef, Injectable, effect, inject } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { concat, filter, from, interval } from 'rxjs';

import { Setting } from '@app/model/setting.model';
import { version } from '@app/package';
import { NotificationService } from '@app/service/notification.service';
import { SettingStore } from '@app/store/setting.store';

const UPDATE_CHECK_INTERVAL = 30 * 60 * 1000;
const SILENT_SYNC_RELOAD_DELAY = 2500;

@Injectable({
	providedIn: 'root',
})
export class UpdateService {
	private readonly applicationRef = inject(ApplicationRef);
	private readonly swUpdate = inject(SwUpdate);
	private readonly notificationService = inject(NotificationService);
	private readonly settingStore = inject(SettingStore);

	private updateNotificationUuid: string | null = null;

	constructor() {
		this.notifyVersionChangeOnStartup();

		if (!this.swUpdate.isEnabled) {
			return;
		}

		this.watchForNewVersions();
		this.scheduleUpdateChecks();
		this.watchUnrecoverableState();
	}

	async applyUpdate(): Promise<void> {
		await this.swUpdate.activateUpdate().catch(() => undefined);

		document.location.reload();
	}

	private notifyVersionChangeOnStartup(): void {
		const waitForSetting = effect(() => {
			if (this.settingStore.isLoading()) {
				return;
			}

			this.compareLastSeenVersion();
			waitForSetting.destroy();
		});
	}

	private compareLastSeenVersion(): void {
		const setting = this.settingStore
			.settingEntities()
			.find((setting) => 'LAST_SEEN_VERSION' === setting.type);

		if (undefined === setting) {
			this.settingStore.add(new Setting({ type: 'LAST_SEEN_VERSION', payload: version }));

			return;
		}

		if (version === setting.payload) {
			return;
		}

		this.settingStore.update(setting.with({ payload: version }));
		this.notificationService.notify(`App updated to v${version}`);
	}

	private watchForNewVersions(): void {
		this.swUpdate.versionUpdates
			.pipe(filter((event): event is VersionReadyEvent => 'VERSION_READY' === event.type))
			.subscribe((event) => {
				const newVersion = this.extractVersion(event.latestVersion.appData);

				if (version === newVersion) {
					this.syncUpdateSilently();

					return;
				}

				this.notifyUpdateAvailable(newVersion);
			});
	}

	private syncUpdateSilently(): void {
		this.notificationService.notify('Syncing app update, the page will reload shortly', {
			timeout: null,
		});

		void this.swUpdate
			.activateUpdate()
			.catch(() => undefined)
			.then(() => {
				setTimeout(() => {
					document.location.reload();
				}, SILENT_SYNC_RELOAD_DELAY);
			});
	}

	private notifyUpdateAvailable(newVersion: string | null): void {
		if (null !== this.updateNotificationUuid) {
			this.notificationService.dismiss(this.updateNotificationUuid);
		}

		const message =
			null === newVersion ? 'A new version is available' : `Version ${newVersion} is available`;

		this.updateNotificationUuid = this.notificationService.notify(message, {
			timeout: null,
			action: {
				label: 'Update',
				callback: () => void this.applyUpdate(),
			},
		});
	}

	private extractVersion(appData: object | undefined): string | null {
		const appVersion = (appData as { version?: unknown } | undefined)?.version;

		return 'string' === typeof appVersion ? appVersion : null;
	}

	private scheduleUpdateChecks(): void {
		concat(from(this.applicationRef.whenStable()), interval(UPDATE_CHECK_INTERVAL)).subscribe(
			() => {
				void this.checkForUpdate();
			},
		);

		document.addEventListener('visibilitychange', () => {
			if ('visible' === document.visibilityState) {
				void this.checkForUpdate();
			}
		});
	}

	private async checkForUpdate(): Promise<void> {
		await this.swUpdate.checkForUpdate().catch(() => undefined);
	}

	private watchUnrecoverableState(): void {
		this.swUpdate.unrecoverable.subscribe(() => {
			document.location.reload();
		});
	}
}
