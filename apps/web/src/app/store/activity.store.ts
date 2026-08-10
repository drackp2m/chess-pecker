import { Injectable, inject } from '@angular/core';
import type { TrainingActivityDay } from '@chesspecker/api-definitions';
import { patchState, signalStore, withState } from '@ngrx/signals';

import { TrainingRepository } from '@app/repository/training.repository';

interface ActivityStoreProps {
	days: readonly TrainingActivityDay[];
	isLoading: boolean;
}

const initialState: ActivityStoreProps = {
	days: [],
	isLoading: false,
};

@Injectable({
	providedIn: 'root',
})
export class ActivityStore extends signalStore({ protectedState: false }, withState(initialState)) {
	private readonly trainingRepository = inject(TrainingRepository);

	async load(): Promise<void> {
		patchState(this, { isLoading: true });

		try {
			const days = await this.trainingRepository.getActivity();

			patchState(this, { days, isLoading: false });
		} catch {
			patchState(this, { isLoading: false });
		}
	}
}
