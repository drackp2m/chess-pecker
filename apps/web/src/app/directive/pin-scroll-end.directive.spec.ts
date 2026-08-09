import { Component, ElementRef, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';

import { PinScrollEndDirective } from '@app/directive/pin-scroll-end.directive';

@Component({
	selector: 'app-pin-host',
	imports: [PinScrollEndDirective],
	template: '<div #scroller [appPinScrollEnd]="columns()"></div>',
})
class PinHostComponent {
	readonly columns = signal<readonly number[]>([1, 2]);
	readonly scroller = viewChild.required<ElementRef<HTMLElement>>('scroller');
}

interface FakeScrollBox {
	scrollLeft: number;
	scrollWidth: number;
}

/** jsdom lays nothing out, so the scroll box is faked around a plain pair of numbers. */
function fakeScrollBox(element: HTMLElement, scrollWidth: number): FakeScrollBox {
	const box = { scrollLeft: 0, scrollWidth };

	Object.defineProperty(element, 'scrollWidth', {
		configurable: true,
		get: () => box.scrollWidth,
	});

	Object.defineProperty(element, 'scrollLeft', {
		configurable: true,
		get: () => box.scrollLeft,
		set: (value: number) => {
			box.scrollLeft = value;
		},
	});

	return box;
}

async function createHost() {
	const fixture = TestBed.createComponent(PinHostComponent);

	fixture.detectChanges();
	await fixture.whenStable();

	const element = fixture.componentInstance.scroller().nativeElement;

	return { fixture, element, box: fakeScrollBox(element, 500) };
}

describe('PinScrollEndDirective', () => {
	afterEach(() => {
		TestBed.resetTestingModule();
	});

	it('pins the scroll to the end when the tracked value changes', async () => {
		const { fixture, box } = await createHost();

		fixture.componentInstance.columns.set([1, 2, 3]);
		fixture.detectChanges();
		await fixture.whenStable();

		expect(box.scrollLeft).toBe(500);
	});

	it('follows the content as it grows', async () => {
		const { fixture, box } = await createHost();

		box.scrollWidth = 900;
		fixture.componentInstance.columns.set([1, 2, 3, 4]);
		fixture.detectChanges();
		await fixture.whenStable();

		expect(box.scrollLeft).toBe(900);
	});

	it('leaves the scroll where the user left it while the value holds', async () => {
		const { fixture, box } = await createHost();

		box.scrollLeft = 120;
		fixture.detectChanges();
		await fixture.whenStable();

		expect(box.scrollLeft).toBe(120);
	});
});
