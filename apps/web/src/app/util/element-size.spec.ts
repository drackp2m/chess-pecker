import { Component, ElementRef, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { elementOffsetWidth, elementWidth, hostWidth } from '@app/util/element-size';

class ResizeObserverStub {
	static readonly instances: ResizeObserverStub[] = [];

	readonly observed: Element[] = [];

	disconnected = false;

	constructor(private readonly callback: ResizeObserverCallback) {
		ResizeObserverStub.instances.push(this);
	}

	observe(target: Element): void {
		this.observed.push(target);
	}

	unobserve(): void {
		return;
	}

	disconnect(): void {
		this.disconnected = true;
	}

	emit(width: number): void {
		const entry = { contentRect: { width, height: 0 } } as unknown as ResizeObserverEntry;

		this.callback([entry], this);
	}

	static forElement(element: Element): ResizeObserverStub {
		const instance = ResizeObserverStub.instances.find((candidate) =>
			candidate.observed.includes(element),
		);

		if (undefined === instance) {
			throw new Error('No observer was attached to the element');
		}

		return instance;
	}
}

@Component({
	selector: 'app-size-host',
	template: '<div #content></div><div #boxed></div>',
})
class SizeHostComponent {
	readonly content = viewChild.required<ElementRef<HTMLElement>>('content');
	readonly boxed = viewChild.required<ElementRef<HTMLElement>>('boxed');

	readonly contentWidth = elementWidth(this.content);
	readonly boxedWidth = elementOffsetWidth(this.boxed);
	readonly ownWidth = hostWidth();
}

async function createHost() {
	const fixture = TestBed.createComponent(SizeHostComponent);

	fixture.detectChanges();
	await fixture.whenStable();

	return fixture;
}

describe('element-size', () => {
	beforeEach(() => {
		ResizeObserverStub.instances.length = 0;
		(globalThis as { ResizeObserver?: unknown }).ResizeObserver = ResizeObserverStub;
	});

	afterEach(() => {
		TestBed.resetTestingModule();
	});

	it('starts at zero until the observer reports a size', () => {
		const fixture = TestBed.createComponent(SizeHostComponent);

		expect(fixture.componentInstance.contentWidth()).toBe(0);
	});

	it('reports the content box width the observer hands over', async () => {
		const fixture = await createHost();
		const component = fixture.componentInstance;

		ResizeObserverStub.forElement(component.content().nativeElement).emit(240.5);

		expect(component.contentWidth()).toBe(240.5);
	});

	it('reads the border box off the element for the offset variants', async () => {
		const fixture = await createHost();
		const component = fixture.componentInstance;
		const element = component.boxed().nativeElement;

		Object.defineProperty(element, 'offsetWidth', { value: 42, configurable: true });
		ResizeObserverStub.forElement(element).emit(999);

		expect(component.boxedWidth()).toBe(42);
	});

	it('observes the host element itself, which no descendant can feed back into', async () => {
		const fixture = await createHost();

		ResizeObserverStub.forElement(fixture.nativeElement as Element).emit(800);

		expect(fixture.componentInstance.ownWidth()).toBe(800);
	});

	it('disconnects every observer when the component goes away', async () => {
		const fixture = await createHost();

		expect(ResizeObserverStub.instances).toHaveLength(3);

		fixture.destroy();

		expect(ResizeObserverStub.instances.every((instance) => instance.disconnected)).toBe(true);
	});
});
