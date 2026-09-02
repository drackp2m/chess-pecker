import { Injectable, effect, inject, signal } from '@angular/core';

import { Setting } from '@app/model/setting.model';
import { SettingStore } from '@app/store/setting.store';

export const DEFAULT_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;
export const TIMEZONES = [
	...new Set([DEFAULT_TIMEZONE, ...Intl.supportedValuesOf('timeZone')]),
] as const;

export function normalizeTimezone(value: unknown): string {
	return 'string' === typeof value && TIMEZONES.includes(value) ? value : DEFAULT_TIMEZONE;
}

@Injectable({
	providedIn: 'root',
})
export class TimezoneService {
	private readonly settingStore = inject(SettingStore);
	private readonly timezone = signal(DEFAULT_TIMEZONE);

	readonly selectedTimezone = this.timezone.asReadonly();

	constructor() {
		const waitForSetting = effect(() => {
			const settings = this.settingStore.settingEntities();

			if (this.settingStore.isLoading()) {
				return;
			}

			const setting = settings.find((item) => 'TIMEZONE' === item.type);

			this.timezone.set(normalizeTimezone(setting?.payload));
			waitForSetting.destroy();
		});
	}

	updateSelectedTimezone(timezone: string): void {
		const normalized = normalizeTimezone(timezone);

		this.timezone.set(normalized);

		const stored = this.settingStore
			.settingEntities()
			.find((setting) => 'TIMEZONE' === setting.type);

		this.settingStore.save(
			stored?.with({ payload: normalized }) ??
				new Setting({ type: 'TIMEZONE', payload: normalized }),
		);
	}
}
