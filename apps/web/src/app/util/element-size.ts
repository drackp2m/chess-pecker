import { DestroyRef, ElementRef, Signal, afterNextRender, inject, signal } from '@angular/core';

type ElementSource = () => ElementRef<HTMLElement> | HTMLElement | undefined;
type SizeReader = (element: HTMLElement, entry: ResizeObserverEntry | null) => number;

export function elementWidth(source: ElementSource): Signal<number> {
	return observeSize(source, (_element, entry) => entry?.contentRect.width ?? 0);
}

export function elementHeight(source: ElementSource): Signal<number> {
	return observeSize(source, (_element, entry) => entry?.contentRect.height ?? 0);
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

/**
 * The border box of a block host is the room its container hands it, so it holds still while
 * the host's own padding moves inside it — a width read off it cannot feed back into itself.
 */
export function hostBorderWidth(): Signal<number> {
	const host = inject<ElementRef<HTMLElement>>(ElementRef);

	return observeSize(
		() => host,
		(element) => element.getBoundingClientRect().width,
	);
}

/** The first size is read straight off the element, so nothing waits a frame for the observer. */
function observeSize(source: ElementSource, read: SizeReader): Signal<number> {
	const size = signal(0);
	const destroyRef = inject(DestroyRef);

	afterNextRender(() => {
		const element = toElement(source());

		if (undefined === element) {
			return;
		}

		size.set(read(element, null));

		const observer = new ResizeObserver(([entry]) => {
			size.set(read(element, entry ?? null));
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
