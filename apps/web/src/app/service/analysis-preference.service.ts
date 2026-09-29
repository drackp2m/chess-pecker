import { Injectable, effect, inject, signal } from '@angular/core';

import {
	AnalysisDepth,
	DEFAULT_ANALYSIS_BAR,
	DEFAULT_ANALYSIS_DEPTH,
	normalizeAnalysisBar,
	normalizeAnalysisDepth,
} from '@app/definition/analysis-preference.type';
import { SettingTypeKey } from '@app/definition/model/setting/setting-type.enum';
import { SettingPayload } from '@app/definition/model/setting/setting-type.type';
import { Setting } from '@app/model/setting.model';
import { SettingStore } from '@app/store/setting.store';

@Injectable({
	providedIn: 'root',
})
export class AnalysisPreferenceService {
	private readonly settingStore = inject(SettingStore);

	private readonly bar = signal<boolean>(DEFAULT_ANALYSIS_BAR);
	private readonly searchDepth = signal<AnalysisDepth>(DEFAULT_ANALYSIS_DEPTH);

	readonly isBarShown = this.bar.asReadonly();
	readonly depth = this.searchDepth.asReadonly();

	constructor() {
		const waitForSetting = effect(() => {
			const settings = this.settingStore.settingEntities();

			if (this.settingStore.isLoading()) {
				return;
			}

			this.bar.set(normalizeAnalysisBar(this.read('ANALYSIS_BAR', settings)));
			this.searchDepth.set(normalizeAnalysisDepth(this.read('ANALYSIS_DEPTH', settings)));
			waitForSetting.destroy();
		});
	}

	updateBar(isShown: boolean): void {
		this.bar.set(isShown);
		this.store('ANALYSIS_BAR', isShown);
	}

	updateDepth(depth: AnalysisDepth): void {
		this.searchDepth.set(depth);
		this.store('ANALYSIS_DEPTH', depth);
	}

	private store<K extends SettingTypeKey>(type: K, payload: SettingPayload[K]): void {
		const stored = this.settingStore.settingEntities().find((setting) => type === setting.type);

		this.settingStore.save(stored?.with({ payload }) ?? new Setting({ type, payload }));
	}

	private read(type: SettingTypeKey, settings: readonly Setting[]): unknown {
		return settings.find((setting) => type === setting.type)?.payload;
	}
}
