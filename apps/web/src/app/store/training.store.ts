import { Injectable, computed, inject } from '@angular/core';
import type {
	SetTrainingGoalRequest,
	Training,
	TrainingProgress,
} from '@chesspecker/api-definitions';
import { patchState, signalStore, withState } from '@ngrx/signals';

import type { TranslationRef } from '@app/definition/i18n.type';
import { I18n, i18nRef } from '@app/i18n';
import { TrainingRunRepository } from '@app/repository/training-run.repository';
import { TrainingRepository } from '@app/repository/training.repository';
import { ApiCancelledError } from '@app/util/api-cancelled-error';
import { API_FAILURE, HttpError } from '@app/util/http-error';

const ACTIVE_STATUSES = ['calibrating', 'planning', 'running'] as const;

interface TrainingStoreProps {
	trainings: readonly Training[];
	active: Training | null;
	progress: TrainingProgress | null;
	isLoading: boolean;
	isSubmitting: boolean;
	error: TranslationRef | null;
}

const initialState: TrainingStoreProps = {
	trainings: [],
	active: null,
	progress: null,
	isLoading: false,
	isSubmitting: false,
	error: null,
};

@Injectable({
	providedIn: 'root',
})
export class TrainingStore extends signalStore({ protectedState: false }, withState(initialState)) {
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

	private readonly trainingRepository = inject(TrainingRepository);
	private readonly trainingRunRepository = inject(TrainingRunRepository);

	async load(): Promise<void> {
		patchState(this, { isLoading: true, error: null });

		try {
			const trainings = await this.trainingRepository.list();
			const active = trainings.find((training) => isActive(training)) ?? null;

			patchState(this, {
				trainings,
				active,
				progress: null === active ? null : await this.trainingRepository.getProgress(active.uuid),
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
			await this.trainingRepository.start();
		}, i18nRef(I18n.training.START_ERROR));
	}

	async selectSet(size: number): Promise<boolean> {
		return this.withActive(
			(uuid) => this.trainingRepository.selectSet(uuid, size),
			i18nRef(I18n.training.SELECT_SET_ERROR),
		);
	}

	async setGoal(goal: SetTrainingGoalRequest): Promise<boolean> {
		return this.withActive(
			(uuid) => this.trainingRepository.setGoal(uuid, goal),
			i18nRef(I18n.training.SET_GOAL_ERROR),
		);
	}

	async startCycle(): Promise<boolean> {
		return this.withActive(
			(uuid) => this.trainingRunRepository.startCycle(uuid),
			i18nRef(I18n.training.START_CYCLE_ERROR),
		);
	}

	async finish(): Promise<boolean> {
		return this.withActive(
			(uuid) => this.trainingRepository.finish(uuid),
			i18nRef(I18n.training.FINISH_ERROR),
		);
	}

	async cancel(): Promise<boolean> {
		return this.withActive(
			(uuid) => this.trainingRepository.cancel(uuid),
			i18nRef(I18n.training.CANCEL_ERROR),
		);
	}

	clearError(): void {
		patchState(this, { error: null });
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

const isActive = (training: Training): boolean =>
	ACTIVE_STATUSES.some((status) => status === training.status);
