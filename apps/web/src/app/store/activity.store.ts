import { Injectable, inject } from '@angular/core';
import type { TrainingActivityDay } from '@chesspecker/api-definitions';
import { patchState, signalStore, withState } from '@ngrx/signals';

import { Resettable } from '@app/definition/resettable.interface';
import { I18n, i18nRef } from '@app/i18n';
import { NotificationService } from '@app/service/notification.service';
import { ActivityHistoryUseCase } from '@app/use-case/activity-history.use-case';

interface ActivityStoreProps {
	days: readonly TrainingActivityDay[];
	isLoading: boolean;
}

const initialState: ActivityStoreProps = {
	days: [],
	isLoading: false,
};

const LOAD_ERROR_MESSAGE = i18nRef(I18n.common.ACTIVITY_LOAD_ERROR);

@Injectable({
	providedIn: 'root',
})
export class ActivityStore
	extends signalStore({ protectedState: false }, withState(initialState))
	implements Resettable
{
	private readonly history = inject(ActivityHistoryUseCase);
	private readonly notificationService = inject(NotificationService);

	/**
	 * Lo guardado se pinta igual aunque el API no conteste, pero sin decirlo la pantalla
	 * estaría afirmando que esos son los datos de ahora mismo.
	 */
	async load(rangeDays: number): Promise<void> {
		patchState(this, { isLoading: true });

		try {
			const { days, isStale } = await this.history.read(rangeDays);

			patchState(this, { days, isLoading: false });

			if (isStale) {
				this.notificationService.notify(LOAD_ERROR_MESSAGE);
			}
		} catch {
			patchState(this, { isLoading: false });
			this.notificationService.notify(LOAD_ERROR_MESSAGE);
		}
	}

	reset(): void {
		patchState(this, initialState);
	}
}
