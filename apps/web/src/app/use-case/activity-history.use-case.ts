import { Injectable, inject } from '@angular/core';
import type { TrainingActivityDay } from '@chesspecker/api-definitions';

import { ActivityRepository } from '@app/repository/activity.repository';
import { ActivityDayRow } from '@app/repository/definition/activity-schema.interface';
import { TrainingRepository } from '@app/repository/training.repository';
import { SessionStore } from '@app/store/session.store';
import { fillActivityDays } from '@app/util/activity-day';
import { ApiCancelledError } from '@app/util/api-cancelled-error';
import { addUtcDays, diffUtcDays, toIsoDate, utcMidnight } from '@app/util/utc-date';

/**
 * `TrainingPolicy.activityMaxDays` from the API, repeated by hand: asking past it would
 * archive the extra days as empty without ever having asked for them.
 */
const API_MAX_RANGE_DAYS = 53 * 7;

export interface ActivityHistory {
	readonly days: readonly TrainingActivityDay[];
	/** Nothing new could be fetched: what comes back is only what was stored. */
	readonly isStale: boolean;
}

@Injectable({
	providedIn: 'root',
})
export class ActivityHistoryUseCase {
	private readonly activityRepository = inject(ActivityRepository);
	private readonly trainingRepository = inject(TrainingRepository);
	private readonly sessionStore = inject(SessionStore);

	/**
	 * The last `rangeDays` days, local first. What is stored is always one run ending today,
	 * so counting its days is enough to spot a gap; a gap asks for the whole range again.
	 */
	async read(rangeDays: number, today: Date = new Date()): Promise<ActivityHistory> {
		const to = utcMidnight(today);
		const wantedFrom = addUtcDays(to, -(Math.min(rangeDays, API_MAX_RANGE_DAYS) - 1));
		const from = await this.keptFrom(wantedFrom);
		const isStale = await this.refresh(from, to);

		const days = await this.activityRepository.findRange(toIsoDate(wantedFrom), toIsoDate(to));

		return { days: fillActivityDays(days, wantedFrom, to), isStale };
	}

	/** The run to keep current: whichever of the stored and the asked-for reaches further. */
	private async keptFrom(wantedFrom: Date): Promise<Date> {
		const firstDate = await this.activityRepository.firstDate();

		if (undefined === firstDate) {
			return wantedFrom;
		}

		const first = utcMidnight(new Date(firstDate));

		return first < wantedFrom ? first : wantedFrom;
	}

	private async refresh(from: Date, to: Date): Promise<boolean> {
		// The aggregate belongs to a user, so without a session there is nothing to ask for and
		// nothing missing: what is stored is all there is.
		if (!this.sessionStore.isAuthenticated()) {
			return false;
		}

		const days = diffUtcDays(from, to) + 1;
		const stored = await this.activityRepository.countRange(toIsoDate(from), toIsoDate(to));
		const cursor = await this.activityRepository.findCursor();

		try {
			await (stored < days || null === cursor
				? this.pullWhole(from, to, days)
				: this.pullChanges(days, cursor));

			return false;
		} catch (error) {
			return !ApiCancelledError.is(error);
		}
	}

	/**
	 * The run is stored whole, zeroed empty days included: the API only returns days with
	 * activity, and nothing else could tell a blank day from one never asked for.
	 */
	private async pullWhole(from: Date, to: Date, days: number): Promise<void> {
		const activity = await this.trainingRepository.getActivity(days);

		await this.activityRepository.saveAll(fillActivityDays(activity.days, from, to).map(toRow));
		await this.activityRepository.saveCursor(activity.cursor);
	}

	/**
	 * Only touched days arrive and only they are rewritten: one that does not come still
	 * holds. None can empty out along the way, since attempts are never deleted.
	 */
	private async pullChanges(days: number, cursor: string): Promise<void> {
		const activity = await this.trainingRepository.getActivity(days, cursor);

		await this.activityRepository.saveAll(activity.days.map(toRow));
		await this.activityRepository.saveCursor(activity.cursor);
	}
}

function toRow(day: TrainingActivityDay): ActivityDayRow {
	const now = new Date();

	return { ...day, createdAt: now, updatedAt: now };
}
