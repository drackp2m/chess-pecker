import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { firstValueFrom, forkJoin } from 'rxjs';

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

	private settle!: () => void;

	private requestedLanguage: Language = DEFAULT_LANGUAGE;

	readonly selectedLanguage = computed(() => this.language());

	/** Resolves once the stored setting decided the language the user actually reads in. */
	readonly whenSettled = new Promise<void>((resolve) => {
		this.settle = resolve;
	});

	constructor() {
		this.applyLanguage();

		const waitForSetting = effect(() => {
			if (this.settingStore.isLoading()) {
				return;
			}

			this.setLanguageFromSettings();
			this.settle();

			waitForSetting.destroy();
		});
	}

	async updateSelectedLanguage(language: Language, saveSetting = true): Promise<void> {
		this.requestedLanguage = language;

		await this.loadActiveScopes(language);

		if (this.requestedLanguage !== language) {
			return;
		}

		this.setLanguage(language);

		if (saveSetting) {
			const stored = this.settingStore
				.settingEntities()
				.find((setting) => 'LANGUAGE' === setting.type);

			this.settingStore.save(
				stored?.with({ payload: language }) ?? new Setting({ type: 'LANGUAGE', payload: language }),
			);
		}
	}

	private setLanguage(language: Language): void {
		this.requestedLanguage = language;

		this.language.set(language);

		this.applyLanguage();
	}

	private applyLanguage(): void {
		const language = this.language();

		this.transloco.setActiveLang(language);

		document.documentElement.setAttribute('lang', language);
	}

	private async loadActiveScopes(language: Language): Promise<void> {
		const current = this.language();
		const paths = [...this.transloco.getTranslation().keys()]
			.filter((path) => path === current || path.endsWith(`/${current}`))
			.map((path) => `${path.slice(0, path.length - current.length)}${language}`);

		if (0 === paths.length) {
			return;
		}

		try {
			await firstValueFrom(forkJoin(paths.map((path) => this.transloco.load(path))));
		} catch (error: unknown) {
			console.error(`Could not load the translations for \`${paths.join('`, `')}\``, error);
		}
	}

	private setLanguageFromSettings(): void {
		const setting = this.settingStore
			.settingEntities()
			.find((setting) => 'LANGUAGE' === setting.type);

		this.setLanguage(
			undefined === setting?.payload
				? normalizeLanguage(navigator.language)
				: normalizeLanguage(setting.payload),
		);
	}
}
