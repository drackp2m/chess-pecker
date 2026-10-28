import {
	AbstractControl,
	FormControl,
	FormGroup,
	ValidationErrors,
	Validators,
} from '@angular/forms';
import { Subscription } from 'rxjs';

export const GoalLimits = {
	minPuzzlesPerDay: 1,
	maxPuzzlesPerDay: 100,
	minDays: 14,
	maxMonths: 6,
} as const;

export type GoalForm = FormGroup<{
	puzzlesPerDay: FormControl<number>;
	endDate: FormControl<string>;
}>;

export interface GoalDateBounds {
	readonly min: string;
	readonly max: string;
}

const DATE_INPUT = /^(\d{4})-(\d{2})-(\d{2})$/u;
const DAY_MS = 24 * 60 * 60 * 1000;

function addDays(date: Date, days: number): Date {
	return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function addMonths(date: Date, months: number): Date {
	return new Date(date.getFullYear(), date.getMonth() + months, date.getDate());
}

function toDateInput(date: Date): string {
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');

	return `${String(date.getFullYear())}-${month}-${day}`;
}

function fromDateInput(value: string): Date | undefined {
	const match = DATE_INPUT.exec(value);

	return null === match
		? undefined
		: new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function daysUntil(today: Date, date: Date): number {
	return Math.round((date.getTime() - addDays(today, 0).getTime()) / DAY_MS);
}

export function goalDateBounds(today: Date = new Date()): GoalDateBounds {
	return {
		min: toDateInput(addDays(today, GoalLimits.minDays)),
		max: toDateInput(addMonths(today, GoalLimits.maxMonths)),
	};
}

function endDateInBounds(control: AbstractControl<string>): ValidationErrors | null {
	if (undefined === fromDateInput(control.value)) {
		return null;
	}

	const { min, max } = goalDateBounds();

	if (control.value < min) {
		return { endDateTooSoon: true };
	}

	return max < control.value ? { endDateTooLate: true } : null;
}

export function createGoalForm(puzzlesPerDay: number): GoalForm {
	return new FormGroup({
		puzzlesPerDay: new FormControl(puzzlesPerDay, {
			nonNullable: true,
			validators: [
				Validators.required,
				Validators.min(GoalLimits.minPuzzlesPerDay),
				Validators.max(GoalLimits.maxPuzzlesPerDay),
			],
		}),
		endDate: new FormControl('', {
			nonNullable: true,
			validators: [Validators.required, endDateInBounds],
		}),
	});
}

export function endDateFor(today: Date, setSize: number, puzzlesPerDay: number): string {
	return toDateInput(addDays(today, Math.ceil(setSize / puzzlesPerDay)));
}

export function puzzlesPerDayFor(today: Date, setSize: number, endDate: string): number {
	const date = fromDateInput(endDate);
	const days = undefined === date ? 0 : daysUntil(today, date);

	return Math.ceil(setSize / Math.max(1, days));
}

export function linkGoalFields(form: GoalForm, setSize: () => number): Subscription {
	const { puzzlesPerDay, endDate } = form.controls;
	const subscription = new Subscription();
	let isFilling = false;

	const follow = (source: AbstractControl, fill: (size: number) => void): void => {
		subscription.add(
			source.valueChanges.subscribe(() => {
				const size = setSize();

				if (isFilling || source.invalid || 0 >= size) {
					return;
				}

				isFilling = true;
				fill(size);
				isFilling = false;
			}),
		);
	};

	follow(puzzlesPerDay, (size) => {
		endDate.setValue(endDateFor(new Date(), size, puzzlesPerDay.value));
	});
	follow(endDate, (size) => {
		puzzlesPerDay.setValue(puzzlesPerDayFor(new Date(), size, endDate.value));
	});

	return subscription;
}
