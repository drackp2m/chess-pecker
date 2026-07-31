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
import { DEFAULT_MOVE_SPEED, MoveSpeed, normalizeMoveSpeed } from '@app/definition/move-speed.type';
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
	private readonly speed = signal<MoveSpeed>(DEFAULT_MOVE_SPEED);

	readonly moveAnimation = this.animation.asReadonly();
	readonly moveInputMethods = this.inputMethods.asReadonly();
	readonly moveSpeed = this.speed.asReadonly();

	constructor() {
		const waitForSetting = effect(() => {
			const settings = this.settingStore.settingEntities();

			if (this.settingStore.isLoading()) {
				return;
			}

			this.animation.set(this.readAnimation(settings));
			this.inputMethods.set(this.readInputMethods(settings));
			this.speed.set(normalizeMoveSpeed(this.read('MOVE_SPEED', settings)));
			waitForSetting.destroy();
		});
	}

	updateMoveAnimation(animation: MoveAnimation): void {
		this.animation.set(animation);
		this.store('MOVE_ANIMATION', animation);
	}

	updateMoveSpeed(speed: MoveSpeed): void {
		this.speed.set(speed);
		this.store('MOVE_SPEED', speed);
	}

	updateMoveInputMethods(methods: readonly MoveInputMethod[]): void {
		const normalized = normalizeMoveInputMethods(methods);

		this.inputMethods.set(normalized);
		this.store('MOVE_INPUT', normalized);
	}

	/** Updates the stored row for a setting, creating it the first time. */
	private store<K extends SettingTypeKey>(type: K, payload: SettingPayload[K]): void {
		const stored = this.settingStore.settingEntities().find((setting) => type === setting.type);

		if (undefined === stored) {
			this.settingStore.add(new Setting({ type, payload }));

			return;
		}

		this.settingStore.update(stored.with({ payload }));
	}

	private read(type: SettingTypeKey, settings: readonly Setting[]): unknown {
		return settings.find((setting) => type === setting.type)?.payload;
	}

	private readAnimation(settings: readonly Setting[]): MoveAnimation {
		const stored = this.read('MOVE_ANIMATION', settings);

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
