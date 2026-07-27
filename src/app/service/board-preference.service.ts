import { Injectable, effect, inject, signal } from '@angular/core';

import {
	DEFAULT_MOVE_ANIMATION,
	MOVE_ANIMATIONS,
	MoveAnimation,
} from '@app/definition/board-animation.type';
import { Setting } from '@app/model/setting.model';
import { SettingStore } from '@app/store/setting.store';

/**
 * Board preferences that outlive a single game, persisted through the same setting
 * store the theme uses. Reads once the stored settings have loaded, then writes
 * back on every change.
 */
@Injectable({
	providedIn: 'root',
})
export class BoardPreferenceService {
	private readonly settingStore = inject(SettingStore);

	private readonly animation = signal<MoveAnimation>(DEFAULT_MOVE_ANIMATION);

	readonly moveAnimation = this.animation.asReadonly();

	constructor() {
		const waitForSetting = effect(() => {
			const settings = this.settingStore.settingEntities();

			if (this.settingStore.isLoading()) {
				return;
			}

			this.animation.set(this.readStored(settings));
			waitForSetting.destroy();
		});
	}

	updateMoveAnimation(animation: MoveAnimation): void {
		this.animation.set(animation);

		const stored = this.settingStore
			.settingEntities()
			.find((setting) => 'MOVE_ANIMATION' === setting.type);

		if (undefined === stored) {
			this.settingStore.add(new Setting({ type: 'MOVE_ANIMATION', payload: animation }));

			return;
		}

		this.settingStore.update(stored.with({ payload: animation }));
	}

	private readStored(settings: readonly Setting[]): MoveAnimation {
		const stored = settings.find((setting) => 'MOVE_ANIMATION' === setting.type)?.payload;

		return MOVE_ANIMATIONS.includes(stored as MoveAnimation)
			? (stored as MoveAnimation)
			: DEFAULT_MOVE_ANIMATION;
	}
}
