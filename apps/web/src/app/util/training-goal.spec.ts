import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
	GoalForm,
	createGoalForm,
	endDateFor,
	linkGoalFields,
	puzzlesPerDayFor,
} from '@app/util/training-goal';

const TODAY = new Date(2026, 9, 26, 12);

function linked(setSize: number): GoalForm {
	const form = createGoalForm(20);

	linkGoalFields(form, () => setSize);

	return form;
}

describe('endDateFor', () => {
	it('counts the days the set takes at that pace from today', () => {
		expect(endDateFor(TODAY, 300, 20)).toBe('2026-11-10');
	});

	it('gives a last, unfinished day a day of its own', () => {
		expect(endDateFor(TODAY, 301, 20)).toBe('2026-11-11');
	});
});

describe('puzzlesPerDayFor', () => {
	it('spreads the set over the days left', () => {
		expect(puzzlesPerDayFor(TODAY, 300, '2026-11-10')).toBe(20);
	});

	it('rounds up, so the date is still met', () => {
		expect(puzzlesPerDayFor(TODAY, 301, '2026-11-10')).toBe(21);
	});
});

describe('createGoalForm', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(TODAY);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('takes between 1 and 100 exercises a day', () => {
		const { puzzlesPerDay } = createGoalForm(20).controls;

		puzzlesPerDay.setValue(0);
		expect(puzzlesPerDay.hasError('min')).toBe(true);

		puzzlesPerDay.setValue(101);
		expect(puzzlesPerDay.hasError('max')).toBe(true);

		puzzlesPerDay.setValue(1);
		expect(puzzlesPerDay.valid).toBe(true);

		puzzlesPerDay.setValue(100);
		expect(puzzlesPerDay.valid).toBe(true);
	});

	it('asks for a date', () => {
		const { endDate } = createGoalForm(20).controls;

		endDate.setValue('');

		expect(endDate.hasError('required')).toBe(true);
	});

	it('takes a date two weeks away at the soonest', () => {
		const { endDate } = createGoalForm(20).controls;

		endDate.setValue('2026-11-08');
		expect(endDate.hasError('endDateTooSoon')).toBe(true);

		endDate.setValue('2026-11-09');
		expect(endDate.valid).toBe(true);
	});

	it('takes a date six months away at the latest', () => {
		const { endDate } = createGoalForm(20).controls;

		endDate.setValue('2027-04-26');
		expect(endDate.valid).toBe(true);

		endDate.setValue('2027-04-27');
		expect(endDate.hasError('endDateTooLate')).toBe(true);
	});
});

describe('linkGoalFields', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(TODAY);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('fills the date in from the pace', () => {
		const form = linked(300);

		form.controls.puzzlesPerDay.setValue(20);

		expect(form.controls.endDate.value).toBe('2026-11-10');
	});

	it('fills the pace in from the date', () => {
		const form = linked(300);

		form.controls.endDate.setValue('2026-11-15');

		expect(form.controls.puzzlesPerDay.value).toBe(15);
	});

	it('leaves the pace as typed when the date it fills in would round it back differently', () => {
		const form = linked(10);

		form.controls.puzzlesPerDay.setValue(6);

		expect(form.controls.endDate.value).toBe('2026-10-28');
		expect(form.controls.puzzlesPerDay.value).toBe(6);
	});

	it('fills nothing in from a pace out of bounds', () => {
		const form = linked(300);

		form.controls.endDate.setValue('2026-11-10');
		form.controls.puzzlesPerDay.setValue(0);

		expect(form.controls.endDate.value).toBe('2026-11-10');
	});

	it('fills nothing in while the set has no size yet', () => {
		const form = linked(0);

		form.controls.puzzlesPerDay.setValue(20);

		expect(form.controls.endDate.value).toBe('');
	});
});
