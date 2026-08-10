import { DestroyRef, ElementRef, Signal, afterNextRender, inject, signal } from '@angular/core';

type ElementSource = () => ElementRef<HTMLElement> | HTMLElement | undefined;
type SizeReader = (element: HTMLElement, entry: ResizeObserverEntry) => number;

export function elementWidth(source: ElementSource): Signal<number> {
	return observeSize(source, (_element, entry) => entry.contentRect.width);
}

export function elementHeight(source: ElementSource): Signal<number> {
	return observeSize(source, (_element, entry) => entry.contentRect.height);
}

export function elementOffsetWidth(source: ElementSource): Signal<number> {
	return observeSize(source, (element) => element.offsetWidth);
}

export function elementOffsetHeight(source: ElementSource): Signal<number> {
	return observeSize(source, (element) => element.offsetHeight);
}

export function hostWidth(): Signal<number> {
	const host = inject<ElementRef<HTMLElement>>(ElementRef);

	return elementWidth(() => host);
}

function observeSize(source: ElementSource, read: SizeReader): Signal<number> {
	const size = signal(0);
	const destroyRef = inject(DestroyRef);

	afterNextRender(() => {
		const element = toElement(source());

		if (undefined === element) {
			return;
		}

		const observer = new ResizeObserver(([entry]) => {
			size.set(undefined === entry ? 0 : read(element, entry));
		});

		observer.observe(element);

		destroyRef.onDestroy(() => {
			observer.disconnect();
		});
	});

	return size.asReadonly();
}

function toElement(
	source: ElementRef<HTMLElement> | HTMLElement | undefined,
): HTMLElement | undefined {
	return source instanceof ElementRef ? source.nativeElement : source;
}
