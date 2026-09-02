import { Injectable, effect, inject } from '@angular/core';
import type { TrainingActivityDay } from '@chesspecker/api-definitions';
import { patchState, signalStore, withState } from '@ngrx/signals';

import { Syncable } from '@app/definition/syncable.interface';
import { I18n, i18nRef } from '@app/i18n';
import { NotificationService } from '@app/service/notification.service';
import { TimezoneService } from '@app/service/timezone.service';
import { NO_SYNC_STATE, withSyncState } from '@app/store/feature/with-sync-state';
import { ActivityAggregateUseCase } from '@app/use-case/activity-aggregate.use-case';

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
	private readonly aggregate = inject(ActivityAggregateUseCase);
	private readonly notificationService = inject(NotificationService);
	private readonly timezoneService = inject(TimezoneService);

	private lastRangeDays: number | null = null;
	private loadedZone: string | null = null;

	constructor() {
		super();

		effect(() => {
			const timeZone = this.timezoneService.selectedTimezone();

			if (null === this.lastRangeDays || timeZone === this.loadedZone || this.isLoading()) {
				return;
			}

			void this.load(this.lastRangeDays);
		});
	}

	async load(rangeDays: number): Promise<void> {
		const timeZone = this.timezoneService.selectedTimezone();

		this.lastRangeDays = rangeDays;
		this.loadedZone = timeZone;
		patchState(this, { isLoading: true });
		await this.whenReady();

		try {
			const days = await this.aggregate.read(rangeDays, timeZone);

			patchState(this, { days, isLoading: false });
		} catch {
			patchState(this, { isLoading: false });
			this.notificationService.notify(LOAD_ERROR_MESSAGE);
		}
	}

	async refresh(): Promise<void> {
		if (null !== this.lastRangeDays) {
			await this.load(this.lastRangeDays);
		}
	}

	reset(): void {
		this.lastRangeDays = null;
		this.loadedZone = null;
		patchState(this, initialState, NO_SYNC_STATE);
	}
}
