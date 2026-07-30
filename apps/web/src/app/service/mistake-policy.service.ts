import { Injectable, effect, inject, signal } from '@angular/core';

import {
	DEFAULT_MISTAKE_POLICY,
	MistakePolicy,
	normalizeMistakePolicy,
} from '@app/definition/mistake-policy.type';
import { Setting } from '@app/model/setting.model';
import { SettingStore } from '@app/store/setting.store';

@Injectable({
	providedIn: 'root',
})
export class MistakePolicyService {
	private readonly settingStore = inject(SettingStore);

	private readonly current = signal<MistakePolicy>(DEFAULT_MISTAKE_POLICY);

	readonly policy = this.current.asReadonly();

	constructor() {
		const waitForSetting = effect(() => {
			const settings = this.settingStore.settingEntities();

			if (this.settingStore.isLoading()) {
				return;
			}

			this.current.set(normalizeMistakePolicy(this.stored(settings)?.payload));
			waitForSetting.destroy();
		});
	}

	update(policy: MistakePolicy): void {
		this.current.set(policy);

		const stored = this.stored(this.settingStore.settingEntities());

		if (undefined === stored) {
			this.settingStore.add(new Setting({ type: 'MISTAKE_POLICY', payload: policy }));

			return;
		}

		this.settingStore.update(stored.with({ payload: policy }));
	}

	private stored(settings: readonly Setting[]): Setting | undefined {
		return settings.find((setting) => 'MISTAKE_POLICY' === setting.type);
	}
}
