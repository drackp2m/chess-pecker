import { Injectable, computed, inject } from '@angular/core';
import type {
	SetTrainingGoalRequest,
	Training,
	TrainingProgress,
} from '@chesspecker/api-definitions';
import { patchState, signalStore, withState } from '@ngrx/signals';

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
	error: string | null;
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
					: { error: HttpError.toMessage(error, 'Could not load your trainings.') }),
			});
		}
	}

	async start(): Promise<boolean> {
		return this.mutate(async () => {
			await this.trainingRepository.start();
		}, 'The training could not be started.');
	}

	async selectSet(size: number): Promise<boolean> {
		return this.withActive(
			(uuid) => this.trainingRepository.selectSet(uuid, size),
			'The set could not be selected.',
		);
	}

	async setGoal(goal: SetTrainingGoalRequest): Promise<boolean> {
		return this.withActive(
			(uuid) => this.trainingRepository.setGoal(uuid, goal),
			'The goal could not be saved.',
		);
	}

	async startCycle(): Promise<boolean> {
		return this.withActive(
			(uuid) => this.trainingRunRepository.startCycle(uuid),
			'The cycle could not be started.',
		);
	}

	async finish(): Promise<boolean> {
		return this.withActive(
			(uuid) => this.trainingRepository.finish(uuid),
			'The training could not be closed.',
		);
	}

	async cancel(): Promise<boolean> {
		return this.withActive(
			(uuid) => this.trainingRepository.cancel(uuid),
			'The training could not be cancelled.',
		);
	}

	clearError(): void {
		patchState(this, { error: null });
	}

	private async withActive(
		action: (uuid: string) => Promise<unknown>,
		fallback: string,
	): Promise<boolean> {
		const active = this.active();

		if (null === active) {
			patchState(this, { error: 'There is no training in progress.' });

			return false;
		}

		return this.mutate(async () => {
			await action(active.uuid);
		}, fallback);
	}

	/** Every write reloads: status, set size and cycles all move together. */
	private async mutate(action: () => Promise<void>, fallback: string): Promise<boolean> {
		patchState(this, { isSubmitting: true, error: null });

		try {
			await action();
		} catch (error) {
			if (API_FAILURE.staleTrainingList === HttpError.toFailure(error)) {
				await this.load();
			}

			patchState(this, { isSubmitting: false, error: HttpError.toMessage(error, fallback) });

			return false;
		}

		await this.load();
		patchState(this, { isSubmitting: false });

		return true;
	}
}

const isActive = (training: Training): boolean =>
	ACTIVE_STATUSES.some((status) => status === training.status);
