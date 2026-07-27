import { Injectable, effect, inject, signal } from '@angular/core';

import {
	DEFAULT_MOVE_ANIMATION,
	MOVE_ANIMATIONS,
	MoveAnimation,
} from '@app/definition/board-animation.type';
import {
	MOVE_INPUT_METHODS,
	MoveInputMethod,
	normalizeMoveInputMethods,
} from '@app/definition/board-input.type';
import { SettingTypeKey } from '@app/definition/model/setting/setting-type.enum';
import { SettingPayload } from '@app/definition/model/setting/setting-type.type';
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
	private readonly defaultInputMethods = inject(MOVE_INPUT_METHODS);

	private readonly animation = signal<MoveAnimation>(DEFAULT_MOVE_ANIMATION);
	private readonly inputMethods = signal<readonly MoveInputMethod[]>(this.defaultInputMethods);

	readonly moveAnimation = this.animation.asReadonly();
	readonly moveInputMethods = this.inputMethods.asReadonly();

	constructor() {
		const waitForSetting = effect(() => {
			const settings = this.settingStore.settingEntities();

			if (this.settingStore.isLoading()) {
				return;
			}

			this.animation.set(this.readAnimation(settings));
			this.inputMethods.set(this.readInputMethods(settings));
			waitForSetting.destroy();
		});
	}

	updateMoveAnimation(animation: MoveAnimation): void {
		this.animation.set(animation);
		this.store('MOVE_ANIMATION', animation);
	}

	updateMoveInputMethods(methods: readonly MoveInputMethod[]): void {
		const normalized = normalizeMoveInputMethods(methods);

		this.inputMethods.set(normalized);
		this.store('MOVE_INPUT', normalized);
	}

	/** Updates the stored row for a setting, creating it the first time. */
	// FixMe => `stored.with()` throws once the entity has been through `updateEntity`
	// (see the FixMe in `SettingStore`): first change adds the row, second updates the
	// instance kept by `addEntity`, third one finds a plain object and blows up with
	// "stored.with is not a function". Unlike `ThemeService` there is no try/catch
	// here, so changing the move animation three times in one session is a live crash.
	private store<K extends SettingTypeKey>(type: K, payload: SettingPayload[K]): void {
		const stored = this.settingStore.settingEntities().find((setting) => type === setting.type);

		if (undefined === stored) {
			this.settingStore.add(new Setting({ type, payload }));

			return;
		}

		this.settingStore.update(stored.with({ payload }));
	}

	private readAnimation(settings: readonly Setting[]): MoveAnimation {
		const stored = settings.find((setting) => 'MOVE_ANIMATION' === setting.type)?.payload;

		return MOVE_ANIMATIONS.includes(stored as MoveAnimation)
			? (stored as MoveAnimation)
			: DEFAULT_MOVE_ANIMATION;
	}

	private readInputMethods(settings: readonly Setting[]): readonly MoveInputMethod[] {
		const stored = settings.find((setting) => 'MOVE_INPUT' === setting.type);

		// Nothing stored yet means the default set, not the empty fallback.
		return undefined === stored
			? this.defaultInputMethods
			: normalizeMoveInputMethods(stored.payload);
	}
}
