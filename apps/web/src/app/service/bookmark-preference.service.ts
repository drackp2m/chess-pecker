import { Injectable, effect, inject, signal } from '@angular/core';

import {
	DEFAULT_BOOKMARK_PROMPT,
	normalizeBookmarkPrompt,
} from '@app/definition/puzzle-bookmark.type';
import { Setting } from '@app/model/setting.model';
import { SettingStore } from '@app/store/setting.store';

/**
 * Whether filing an exercise asks which list it goes to. Turned off, a press files it under
 * favorites and holding the icon is what brings the question back.
 */
@Injectable({
	providedIn: 'root',
})
export class BookmarkPreferenceService {
	private readonly settingStore = inject(SettingStore);

	private readonly prompt = signal<boolean>(DEFAULT_BOOKMARK_PROMPT);

	readonly isPromptEnabled = this.prompt.asReadonly();

	constructor() {
		const waitForSetting = effect(() => {
			const settings = this.settingStore.settingEntities();

			if (this.settingStore.isLoading()) {
				return;
			}

			const stored = settings.find((setting) => 'BOOKMARK_PROMPT' === setting.type)?.payload;

			this.prompt.set(normalizeBookmarkPrompt(stored));
			waitForSetting.destroy();
		});
	}

	updatePrompt(isEnabled: boolean): void {
		const stored = this.settingStore
			.settingEntities()
			.find((setting) => 'BOOKMARK_PROMPT' === setting.type);

		this.prompt.set(isEnabled);
		this.settingStore.save(
			stored?.with({ payload: isEnabled }) ??
				new Setting({ type: 'BOOKMARK_PROMPT', payload: isEnabled }),
		);
	}
}
