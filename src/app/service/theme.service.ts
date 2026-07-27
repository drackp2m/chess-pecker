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
		this.applyActiveTheme();

		const waitForSetting = effect(() => {
			if (this.settingStore.isLoading()) {
				return;
			}

			this.setThemeFromSettings();

			waitForSetting.destroy();
		});
	}

	ngOnDestroy(): void {
		if (this.updateTheme !== undefined) {
			this.mediaQuery.removeEventListener('change', this.updateTheme);
		}
	}

	updateSelectedTheme(theme: Theme | 'system', saveSetting = true): void {
		this.theme.set(theme);

		this.applyActiveTheme();

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
				// FixMe => root cause found: `@ngrx/signals/entities` `updateEntity` rebuilds
				// the entity as `{ ...entity, ...changes }`, a plain object literal, so the
				// `Setting` prototype is dropped the first time `SettingStore.update()` runs.
				// From then on `settingEntities()` is typed `Setting[]` but holds plain data
				// and `.with()` is gone — hence this catch. Fix it at the source (see the
				// FixMe in `SettingStore`), then delete this try/catch.
			}
		}
	}

	private applyActiveTheme(): void {
		document.documentElement.setAttribute('data-theme', this.activeTheme());
	}

	private addMediaQueryEventListener(): void {
		this.updateTheme = ({ matches }: MediaQueryListEvent | MediaQueryList) => {
			this.prefersColorScheme.set(matches ? 'dark' : 'light');

			this.applyActiveTheme();
		};

		this.mediaQuery.addEventListener('change', this.updateTheme);
	}

	private setThemeFromSettings() {
		const setting = this.settingStore.settingEntities().find((setting) => 'THEME' === setting.type);

		this.updateSelectedTheme((setting?.payload as Theme | 'system' | undefined) ?? 'system', false);
	}
}
