import { Component, ElementRef, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LONG_PRESS_MS } from '@app/definition/long-press.constant';
import { LongPressDirective } from '@app/directive/long-press.directive';

@Component({
	selector: 'app-long-press-host',
	imports: [LongPressDirective],
	template: `<button
		#target
		appLongPress
		[disabled]="isDisabled()"
		(shortPress)="answered.push('short')"
		(longPress)="answered.push('long')"
	>
		press
	</button>`,
})
class LongPressHostComponent {
	readonly isDisabled = signal(false);
	readonly target = viewChild.required<ElementRef<HTMLButtonElement>>('target');
	readonly answered: string[] = [];
}

function createHost() {
	const fixture = TestBed.createComponent(LongPressHostComponent);

	fixture.detectChanges();

	return { fixture, host: fixture.componentInstance, button: fixture.componentInstance.target() };
}

function press(element: HTMLElement, held: boolean): void {
	element.dispatchEvent(new PointerEvent('pointerdown', { clientX: 10, clientY: 10 }));

	if (held) {
		vi.advanceTimersByTime(LONG_PRESS_MS);
	}

	element.dispatchEvent(new PointerEvent('pointerup', { clientX: 10, clientY: 10 }));
	element.dispatchEvent(new MouseEvent('click'));
}

describe('LongPressDirective', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
		TestBed.resetTestingModule();
	});

	it('answers a press let go of in time as a short one', () => {
		const { host, button } = createHost();

		press(button.nativeElement, false);

		expect(host.answered).toEqual(['short']);
	});

	it('answers a press held long enough as a long one, and only as that', () => {
		const { host, button } = createHost();

		press(button.nativeElement, true);

		expect(host.answered).toEqual(['long']);
	});

	it('marks the host while the press is being waited out', () => {
		const { fixture, button } = createHost();
		const element = button.nativeElement;

		element.dispatchEvent(new PointerEvent('pointerdown', { clientX: 10, clientY: 10 }));
		fixture.detectChanges();

		expect(element.classList.contains('holding')).toBe(true);

		element.dispatchEvent(new PointerEvent('pointerup', { clientX: 10, clientY: 10 }));
		fixture.detectChanges();

		expect(element.classList.contains('holding')).toBe(false);
	});

	it('drops a press whose host is disabled before it is let go of', () => {
		const { fixture, host, button } = createHost();
		const element = button.nativeElement;

		element.dispatchEvent(new PointerEvent('pointerdown', { clientX: 10, clientY: 10 }));

		host.isDisabled.set(true);
		fixture.detectChanges();

		vi.advanceTimersByTime(LONG_PRESS_MS);
		element.dispatchEvent(new PointerEvent('pointerup', { clientX: 10, clientY: 10 }));
		element.dispatchEvent(new MouseEvent('click'));
		fixture.detectChanges();

		expect(host.answered).toEqual([]);
		expect(element.classList.contains('holding')).toBe(false);
	});

	it('answers nothing at all on a disabled host, and does not mark it either', () => {
		const { fixture, host, button } = createHost();

		host.isDisabled.set(true);
		fixture.detectChanges();

		press(button.nativeElement, true);
		fixture.detectChanges();

		expect(host.answered).toEqual([]);
		expect(button.nativeElement.classList.contains('holding')).toBe(false);
	});
});
