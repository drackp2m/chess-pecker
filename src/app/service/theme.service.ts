import { Injectable, OnDestroy, computed, effect, inject, signal } from '@angular/core';

import { Theme } from '@app/definition/service/theme.type';
import { Setting } from '@app/model/setting.model';
import { SettingStore } from '@app/store/setting.store';

@Injectable({
	providedIn: 'root',
})
export class ThemeService implements OnDestroy {
	private readonly settingStore = inject(SettingStore);

	private readonly mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
	private updateTheme?: (e: MediaQueryListEvent | MediaQueryList) => void;
	private readonly theme = signal<Theme | 'system'>('system');
	private readonly prefersColorScheme = signal<Theme>(
		window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
	);

	readonly selectedTheme = computed(() => this.theme());
	readonly activeTheme = computed(() => {
		const theme = this.theme();
		const prefersColorScheme = this.prefersColorScheme();

		const selectedTheme = 'system' === theme ? prefersColorScheme : theme;

		return selectedTheme;
	});

	constructor() {
		this.addMediaQueryEventListener();

		const waitForSetting = effect(() => {
			const entities = this.settingStore.settingEntities();
			const isLoading = this.settingStore.isLoading();

			if (!isLoading && 0 < entities.length) {
				this.setThemeFromSettings();

				waitForSetting.destroy();
			}
		});
	}

	ngOnDestroy(): void {
		if (this.updateTheme !== undefined) {
			this.mediaQuery.removeEventListener('change', this.updateTheme);
		}
	}

	updateSelectedTheme(theme: Theme | 'system', saveSetting = true): void {
		this.theme.set(theme);

		if ('system' !== theme) {
			document.documentElement.setAttribute('data-theme', theme);
		} else {
			document.documentElement.setAttribute('data-theme', this.prefersColorScheme());
		}

		if (saveSetting) {
			try {
				const newSetting = this.settingStore
					.settingEntities()
					.find((setting) => 'THEME' === setting.type)
					?.with({ payload: theme });

				if (undefined !== newSetting) {
					this.settingStore.update(newSetting);
				} else {
					this.settingStore.add(new Setting({ type: 'THEME', payload: theme }));
				}
			} catch {
				// FixMe => Why need this for prevent Uncaught (in promise) TypeError:
				// this.settingStore.settingEntities().find(...).with is not a function
			}
		}
	}

	private addMediaQueryEventListener(): void {
		this.updateTheme = ({ matches }: MediaQueryListEvent | MediaQueryList) => {
			const theme = matches ? 'dark' : 'light';

			this.prefersColorScheme.set(theme);

			if ('system' === this.theme()) {
				document.documentElement.setAttribute('data-theme', theme);
			}
		};

		this.mediaQuery.addEventListener('change', this.updateTheme);
	}

	private setThemeFromSettings() {
		const setting = this.settingStore.settingEntities().find((setting) => 'THEME' === setting.type);

		if (setting !== undefined) {
			this.updateSelectedTheme(setting.payload as Theme, false);
		} else {
			this.updateSelectedTheme('system');
		}
	}
}
