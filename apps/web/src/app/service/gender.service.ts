import { Injectable, Injector, effect, inject, signal } from '@angular/core';

import { DEFAULT_GENDER, Gender, normalizeGender } from '@app/definition/model/setting/gender.type';
import { Setting } from '@app/model/setting.model';
import { SettingStore } from '@app/store/setting.store';

@Injectable({
	providedIn: 'root',
})
export class GenderService {
	private readonly injector = inject(Injector);

	private readonly gender = signal<Gender>(DEFAULT_GENDER);

	readonly selectedGender = this.gender.asReadonly();

	constructor() {
		const waitForSetting = effect(() => {
			const settingStore = this.injector.get(SettingStore);
			const settings = settingStore.settingEntities();

			if (settingStore.isLoading()) {
				return;
			}

			const stored = settings.find((setting) => 'GENDER' === setting.type)?.payload;

			this.gender.set(normalizeGender(stored));
			waitForSetting.destroy();
		});
	}

	updateSelectedGender(gender: Gender): void {
		const settingStore = this.injector.get(SettingStore);
		const stored = settingStore.settingEntities().find((setting) => 'GENDER' === setting.type);

		this.gender.set(gender);
		settingStore.save(
			stored?.with({ payload: gender }) ?? new Setting({ type: 'GENDER', payload: gender }),
		);
	}
}
