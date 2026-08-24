import { Injectable, computed, effect, inject } from '@angular/core';
import { patchState, signalStore, withState } from '@ngrx/signals';

import { INTRO_STEPS } from '@app/definition/intro-step.type';
import { IntroProgress } from '@app/definition/model/setting/intro-progress.type';
import { Setting } from '@app/model/setting.model';
import { SettingStore } from '@app/store/setting.store';

interface IntroStoreProps {
	index: number;
	isCompleted: boolean;
	isRevisit: boolean;
	isRestored: boolean;
}

const initialState: IntroStoreProps = {
	index: 0,
	isCompleted: false,
	isRevisit: false,
	isRestored: false,
};

const clampIndex = (index: number): number =>
	Math.min(Math.max(Math.trunc(index), 0), INTRO_STEPS.length - 1);

@Injectable({
	providedIn: 'root',
})
export class IntroStore extends signalStore({ protectedState: false }, withState(initialState)) {
	readonly stepCount = INTRO_STEPS.length;

	readonly step = computed(() => INTRO_STEPS[this.index()] ?? INTRO_STEPS[0]);
	readonly isFirst = computed(() => 0 === this.index());
	readonly isLast = computed(() => this.index() === this.stepCount - 1);

	private readonly settingStore = inject(SettingStore);

	constructor() {
		super();

		this.watchStoredProgress();
	}

	enter(): void {
		if (this.isCompleted()) {
			patchState(this, { index: 0, isRevisit: true });
		}
	}

	next(): void {
		this.goTo(this.index() + 1);
	}

	previous(): void {
		this.goTo(this.index() - 1);
	}

	complete(): void {
		patchState(this, { isCompleted: true });

		this.persist();
	}

	private goTo(index: number): void {
		const next = clampIndex(index);

		if (next === this.index()) {
			return;
		}

		patchState(this, { index: next });

		this.persist();
	}

	private watchStoredProgress(): void {
		const waitForSetting = effect(() => {
			if (this.settingStore.isLoading()) {
				return;
			}

			this.restore();

			waitForSetting.destroy();
		});
	}

	private restore(): void {
		const progress = this.stored()?.payload as IntroProgress | undefined;
		const isCompleted = progress?.isCompleted ?? false;

		patchState(this, {
			index: isCompleted ? 0 : clampIndex(progress?.step ?? 0),
			isCompleted,
			isRevisit: isCompleted,
			isRestored: true,
		});
	}

	private persist(): void {
		const stored = this.stored();
		const payload: IntroProgress = { step: this.index(), isCompleted: this.isCompleted() };

		this.settingStore.save(stored?.with({ payload }) ?? new Setting({ type: 'INTRO', payload }));
	}

	private stored(): Setting | undefined {
		return this.settingStore.settingEntities().find((setting) => 'INTRO' === setting.type);
	}
}
