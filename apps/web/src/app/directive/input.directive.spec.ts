import { Component, ElementRef, Type, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { InputDirective } from '@app/directive/input.directive';

class ResizeObserverStub {
	observe(): void {
		return;
	}

	unobserve(): void {
		return;
	}

	disconnect(): void {
		return;
	}
}

@Component({
	selector: 'app-input-host',
	imports: [InputDirective],
	template: `<input #field appThemed type="number" />`,
})
class InputHostComponent {
	readonly field = viewChild.required<ElementRef<HTMLInputElement>>('field');
}

@Component({
	selector: 'app-date-input-host',
	imports: [InputDirective],
	template: `<input #field appThemed type="date" />`,
})
class DateInputHostComponent {
	readonly field = viewChild.required<ElementRef<HTMLInputElement>>('field');
}

@Component({
	selector: 'app-form-input-host',
	imports: [InputDirective, ReactiveFormsModule],
	template: `<input #field appThemed type="number" [formControl]="control" />`,
})
class FormInputHostComponent {
	readonly field = viewChild.required<ElementRef<HTMLInputElement>>('field');
	readonly control = new FormControl<number | null>(null);
}

interface FieldHost {
	field(): ElementRef<HTMLInputElement>;
}

function createField<THost extends FieldHost>(
	host: Type<THost> = InputHostComponent as unknown as Type<THost>,
): { field: HTMLInputElement; host: THost } {
	const fixture = TestBed.createComponent(host);

	fixture.detectChanges();

	return {
		field: fixture.componentInstance.field().nativeElement,
		host: fixture.componentInstance,
	};
}

function type(field: HTMLInputElement, value: string, unparsable = false): void {
	field.value = value;

	Object.defineProperty(field, 'validity', {
		configurable: true,
		get: () => ({ badInput: unparsable }),
	});

	field.dispatchEvent(new Event('input'));
}

function isFilled(field: HTMLInputElement): boolean {
	return field.closest('.app-input')?.classList.contains('filled') ?? false;
}

describe('InputDirective', () => {
	beforeEach(() => {
		vi.stubGlobal('ResizeObserver', ResizeObserverStub);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		TestBed.resetTestingModule();
	});

	it('marks as filled a field holding a value', () => {
		const { field } = createField();

		type(field, '12');

		expect(isFilled(field)).toBe(true);
	});

	it('clears the mark once the field is emptied', () => {
		const { field } = createField();

		type(field, '12');
		type(field, '');

		expect(isFilled(field)).toBe(false);
	});

	it('marks as filled a number field holding text it cannot parse yet', () => {
		const { field } = createField();

		type(field, '', true);

		expect(isFilled(field)).toBe(true);
	});

	it('marks a date field as filled while it is still empty, since the picker shows its mask', () => {
		const { field } = createField(DateInputHostComponent);

		expect(isFilled(field)).toBe(true);
	});

	it('marks as filled a field whose value the form writes, not the user', () => {
		const { field, host } = createField(FormInputHostComponent);

		host.control.setValue(12);

		expect(isFilled(field)).toBe(true);
	});
});
