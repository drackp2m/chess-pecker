import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';

import { DEFAULT_LANGUAGE, Language, normalizeLanguage } from '@app/definition/language.type';
import { Setting } from '@app/model/setting.model';
import { SettingStore } from '@app/store/setting.store';

@Injectable({
	providedIn: 'root',
})
export class LanguageService {
	private readonly settingStore = inject(SettingStore);
	private readonly transloco = inject(TranslocoService);

	private readonly language = signal<Language>(DEFAULT_LANGUAGE);

	readonly selectedLanguage = computed(() => this.language());

	constructor() {
		this.applyLanguage();

		const waitForSetting = effect(() => {
			if (this.settingStore.isLoading()) {
				return;
			}

			this.setLanguageFromSettings();

			waitForSetting.destroy();
		});
	}

	updateSelectedLanguage(language: Language, saveSetting = true): void {
		this.language.set(language);

		this.applyLanguage();

		if (saveSetting) {
			const stored = this.settingStore
				.settingEntities()
				.find((setting) => 'LANGUAGE' === setting.type);

			this.settingStore.save(
				stored?.with({ payload: language }) ?? new Setting({ type: 'LANGUAGE', payload: language }),
			);
		}
	}

	private applyLanguage(): void {
		const language = this.language();

		this.transloco.setActiveLang(language);

		document.documentElement.setAttribute('lang', language);
	}

	private setLanguageFromSettings(): void {
		const setting = this.settingStore
			.settingEntities()
			.find((setting) => 'LANGUAGE' === setting.type);

		this.updateSelectedLanguage(
			undefined === setting?.payload
				? normalizeLanguage(navigator.language)
				: normalizeLanguage(setting.payload),
			false,
		);
	}
}
