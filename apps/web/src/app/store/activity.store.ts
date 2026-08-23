import { Injectable, inject } from '@angular/core';
import type { TrainingActivityDay } from '@chesspecker/api-definitions';
import { patchState, signalStore, withState } from '@ngrx/signals';

import { Syncable } from '@app/definition/syncable.interface';
import { I18n, i18nRef } from '@app/i18n';
import { NotificationService } from '@app/service/notification.service';
import { NO_SYNC_STATE, withSyncState } from '@app/store/feature/with-sync-state';
import { ActivityHistoryUseCase } from '@app/use-case/activity-history.use-case';

interface ActivityStoreProps {
	days: readonly TrainingActivityDay[];
}

const initialState: ActivityStoreProps = {
	days: [],
};

const LOAD_ERROR_MESSAGE = i18nRef(I18n.common.ACTIVITY_LOAD_ERROR);

@Injectable({
	providedIn: 'root',
})
export class ActivityStore
	extends signalStore({ protectedState: false }, withState(initialState), withSyncState())
	implements Syncable
{
	private readonly history = inject(ActivityHistoryUseCase);
	private readonly notificationService = inject(NotificationService);

	/**
	 * What is stored is painted even when the API does not answer, but unsaid the screen would
	 * be claiming those are the numbers right now.
	 */
	async load(rangeDays: number): Promise<void> {
		patchState(this, { isLoading: true });
		await this.whenReady();

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
		patchState(this, initialState, NO_SYNC_STATE);
	}
}
