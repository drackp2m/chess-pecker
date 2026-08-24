import { Injectable, computed, inject } from '@angular/core';
import type { SetTrainingGoalRequest, TrainingProgress } from '@chesspecker/api-definitions';
import { patchState, signalStore, withState } from '@ngrx/signals';

import type { TranslationRef } from '@app/definition/i18n.type';
import { Syncable } from '@app/definition/syncable.interface';
import { I18n, i18nRef } from '@app/i18n';
import { TrainingRow } from '@app/repository/definition/training-schema.interface';
import { NO_SYNC_STATE, withSyncState } from '@app/store/feature/with-sync-state';
import { isActiveTraining } from '@app/use-case/local-training.use-case';
import { TrainingEngineUseCase } from '@app/use-case/training-engine.use-case';
import { ApiCancelledError } from '@app/util/api-cancelled-error';
import { API_FAILURE, HttpError } from '@app/util/http-error';

interface TrainingStoreProps {
	trainings: readonly TrainingRow[];
	active: TrainingRow | null;
	progress: TrainingProgress | null;
}

const initialState: TrainingStoreProps = {
	trainings: [],
	active: null,
	progress: null,
};

@Injectable({
	providedIn: 'root',
})
export class TrainingStore
	extends signalStore({ protectedState: false }, withState(initialState), withSyncState())
	implements Syncable
{
	readonly cycles = computed(() => this.progress()?.cycles ?? []);

	readonly runningCycle = computed(() => this.cycles().find((cycle) => 'running' === cycle.status));

	/** A cycle can only be opened when the previous one is closed and the set is fixed. */
	readonly canStartCycle = computed(() => {
		const progress = this.progress();
		const status = this.active()?.status;

		if (null === progress || undefined === status) {
			return false;
		}

		const isReady = 'planning' === status || 'running' === status;

		return isReady && undefined === this.runningCycle() && 0 < progress.setSize;
	});

	private readonly engine = inject(TrainingEngineUseCase);

	/**
	 * Reads only what is already here: the sync cycle pulls the history before the app serves
	 * data, so the solved exercises are in place by the time this runs.
	 */
	async load(): Promise<void> {
		patchState(this, { isLoading: true, error: null });
		await this.whenReady();

		try {
			const trainings = await this.engine.list();
			const active = trainings.find((training) => isActiveTraining(training)) ?? null;

			patchState(this, {
				trainings,
				active,
				progress: null === active ? null : await this.engine.getProgress(active.uuid),
				isLoading: false,
			});
		} catch (error) {
			patchState(this, {
				isLoading: false,
				...(ApiCancelledError.is(error)
					? {}
					: { error: HttpError.toRef(error, i18nRef(I18n.training.LOAD_ERROR)) }),
			});
		}
	}

	async start(): Promise<boolean> {
		return this.mutate(async () => {
			await this.engine.start();
		}, i18nRef(I18n.training.START_ERROR));
	}

	async selectSet(size: number): Promise<boolean> {
		return this.withActive(
			(uuid) => this.engine.selectSet(uuid, size),
			i18nRef(I18n.training.SELECT_SET_ERROR),
		);
	}

	async setGoal(goal: SetTrainingGoalRequest): Promise<boolean> {
		return this.withActive(
			(uuid) => this.engine.setGoal(uuid, goal),
			i18nRef(I18n.training.SAVE_PACE_ERROR),
		);
	}

	async startCycle(): Promise<boolean> {
		return this.withActive(
			(uuid) => this.engine.startCycle(uuid),
			i18nRef(I18n.training.START_CYCLE_ERROR),
		);
	}

	async finish(): Promise<boolean> {
		return this.withActive((uuid) => this.engine.finish(uuid), i18nRef(I18n.training.FINISH_ERROR));
	}

	async cancel(): Promise<boolean> {
		return this.withActive((uuid) => this.engine.cancel(uuid), i18nRef(I18n.training.CANCEL_ERROR));
	}

	reset(): void {
		patchState(this, initialState, NO_SYNC_STATE);
	}

	private async withActive(
		action: (uuid: string) => Promise<unknown>,
		fallback: TranslationRef,
	): Promise<boolean> {
		const active = this.active();

		if (null === active) {
			patchState(this, { error: i18nRef(I18n.training.NONE_IN_PROGRESS) });

			return false;
		}

		return this.mutate(async () => {
			await action(active.uuid);
		}, fallback);
	}

	/** Every write reloads: status, set size and cycles all move together. */
	private async mutate(action: () => Promise<void>, fallback: TranslationRef): Promise<boolean> {
		patchState(this, { isSubmitting: true, error: null });

		try {
			await action();
		} catch (error) {
			if (API_FAILURE.staleTrainingList === HttpError.toFailure(error)) {
				await this.load();
			}

			patchState(this, { isSubmitting: false, error: HttpError.toRef(error, fallback) });

			return false;
		}

		await this.load();
		patchState(this, { isSubmitting: false });

		return true;
	}
}
