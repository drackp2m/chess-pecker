import { Component, ElementRef, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
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

function createField(): HTMLInputElement {
	const fixture = TestBed.createComponent(InputHostComponent);

	fixture.detectChanges();

	return fixture.componentInstance.field().nativeElement;
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
		const field = createField();

		type(field, '12');

		expect(isFilled(field)).toBe(true);
	});

	it('clears the mark once the field is emptied', () => {
		const field = createField();

		type(field, '12');
		type(field, '');

		expect(isFilled(field)).toBe(false);
	});

	it('marks as filled a number field holding text it cannot parse yet', () => {
		const field = createField();

		type(field, '', true);

		expect(isFilled(field)).toBe(true);
	});
});
