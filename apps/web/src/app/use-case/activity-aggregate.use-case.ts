import { Injectable, inject } from '@angular/core';
import type { TrainingActivityDay } from '@chesspecker/api-definitions';

import { AttemptRepository } from '@app/repository/attempt.repository';
import type { AttemptRow } from '@app/repository/definition/attempt-schema.interface';
import { fillActivityDays } from '@app/util/activity-day';
import { addLabelDays, labelToUtcMidnight, zoneDayLabel } from '@app/util/timezone-date';

const MAX_ACTIVITY_DAYS = 53 * 7;

interface ActivityCounts {
	done: number;
	firstTry: number;
	afterMiss: number;
	shown: number;
	foundClean: number;
	foundHinted: number;
	foundMissed: number;
	foundMissedHinted: number;
	revealed: number;
	revealedHinted: number;
	mistakes: number;
	hints: number;
	durationMs: number;
}

interface MonthDays {
	count: number;
	days: readonly TrainingActivityDay[];
}

@Injectable({
	providedIn: 'root',
})
export class ActivityAggregateUseCase {
	private readonly attempts = inject(AttemptRepository);

	private readonly months = new Map<string, MonthDays>();

	async read(
		rangeDays: number,
		timeZone: string,
		today: Date = new Date(),
	): Promise<readonly TrainingActivityDay[]> {
		const to = zoneDayLabel(today, timeZone);
		const from = addLabelDays(to, -(Math.min(rangeDays, MAX_ACTIVITY_DAYS) - 1));
		const days: TrainingActivityDay[] = [];

		for (const month of monthsIn(from, to)) {
			days.push(...(await this.monthDays(month, timeZone)));
		}

		return fillActivityDays(days, labelToUtcMidnight(from), labelToUtcMidnight(to));
	}

	private async monthDays(
		month: string,
		timeZone: string,
	): Promise<readonly TrainingActivityDay[]> {
		const [start, end] = monthBounds(month);
		const lower = labelToUtcMidnight(addLabelDays(start, -1));
		const upper = labelToUtcMidnight(addLabelDays(end, 2));
		const count = await this.attempts.countRangeByUpdatedAt(lower, upper);
		const cached = this.months.get(`${timeZone}:${month}`);

		if (cached?.count === count) {
			return cached.days;
		}

		const rows = await this.attempts.findRangeByUpdatedAt(lower, upper);
		const days = aggregate(rows, start, end, timeZone);

		this.months.set(`${timeZone}:${month}`, { count, days });

		return days;
	}
}

function monthsIn(from: string, to: string): string[] {
	const last = to.slice(0, 7);
	const months: string[] = [];
	let month = from.slice(0, 7);

	while (month <= last) {
		months.push(month);
		month = nextMonth(month);
	}

	return months;
}

function monthBounds(month: string): readonly [string, string] {
	return [`${month}-01`, addLabelDays(`${nextMonth(month)}-01`, -1)];
}

function nextMonth(month: string): string {
	return addLabelDays(`${month}-01`, 32).slice(0, 7);
}

function aggregate(
	attempts: readonly AttemptRow[],
	from: string,
	to: string,
	timeZone: string,
): TrainingActivityDay[] {
	const byDate = new Map<string, ActivityCounts>();

	for (const attempt of attempts) {
		const date = zoneDayLabel(attempt.updatedAt, timeZone);

		if (date < from || date > to) {
			continue;
		}

		const counts = byDate.get(date) ?? emptyCounts();

		addAttempt(counts, attempt);
		byDate.set(date, counts);
	}

	return [...byDate].map(([date, counts]) => ({ date, ...counts }));
}

function emptyCounts(): ActivityCounts {
	return {
		done: 0,
		firstTry: 0,
		afterMiss: 0,
		shown: 0,
		foundClean: 0,
		foundHinted: 0,
		foundMissed: 0,
		foundMissedHinted: 0,
		revealed: 0,
		revealedHinted: 0,
		mistakes: 0,
		hints: 0,
		durationMs: 0,
	};
}

function addAttempt(counts: ActivityCounts, attempt: AttemptRow): void {
	counts.done += 1;
	counts.firstTry += Number(attempt.solved);
	counts.afterMiss += Number(!attempt.solved && 'revealed' !== attempt.closure);
	counts.shown += Number(!attempt.solved && 'revealed' === attempt.closure);
	counts.foundClean += Number(
		'found' === attempt.closure && !attempt.hintUsed && 0 === attempt.mistakeCount,
	);
	counts.foundHinted += Number(
		'found' === attempt.closure && attempt.hintUsed && 0 === attempt.mistakeCount,
	);
	counts.foundMissed += Number(
		'found' === attempt.closure && !attempt.hintUsed && 0 < attempt.mistakeCount,
	);
	counts.foundMissedHinted += Number(
		'found' === attempt.closure && attempt.hintUsed && 0 < attempt.mistakeCount,
	);
	counts.revealed += Number('revealed' === attempt.closure && !attempt.hintUsed);
	counts.revealedHinted += Number('revealed' === attempt.closure && attempt.hintUsed);
	counts.mistakes += attempt.mistakeCount;
	counts.hints += Number(attempt.hintUsed);
	counts.durationMs += attempt.durationMs;
}
