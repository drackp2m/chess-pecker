import { Injectable, OnDestroy, signal } from '@angular/core';

import { ResizeEvent, ScrollEvent } from '@app/definition/service/viewport.interface';

const DEBOUNCE_TIMEOUT = 100;

@Injectable({ providedIn: 'root' })
export class ViewportService implements OnDestroy {
	readonly windowResized = signal<ResizeEvent>({
		type: 'resize',
		width: window.innerWidth,
		height: window.innerHeight,
		innerWidth: window.innerWidth,
		innerHeight: window.innerHeight,
		timestamp: Date.now(),
	});

	readonly routerOutletScroll = signal<ScrollEvent>({
		type: 'scroll',
		elementId: 'router-outlet',
		scrollTop: 0,
		scrollLeft: 0,
		scrollHeight: 0,
		scrollWidth: 0,
		timestamp: Date.now(),
	});

	private eventListeners = new Map<string, EventListener>();

	constructor() {
		this.setupScrollListener('router-outlet');
		this.setupResizeListener();
	}

	ngOnDestroy() {
		this.eventListeners.forEach((listener, key) => {
			const [elementId, eventType] = key.split('.') as [string, string];

			if ('resize' === eventType && 'window' === elementId) {
				window.removeEventListener('resize', listener);
			} else if ('scroll' === eventType) {
				const element = document.getElementById(elementId);

				if (null !== element) {
					element.removeEventListener('scroll', listener);
				}
			}
		});

		this.eventListeners.clear();
	}

	private setupResizeListener() {
		let timeout: number | null = null;

		const resizeHandler = () => {
			if (null !== timeout) {
				window.clearTimeout(timeout);
			}

			timeout = window.setTimeout(() => {
				this.windowResized.set({
					type: 'resize',
					width: window.innerWidth,
					height: window.innerHeight,
					innerWidth: window.innerWidth,
					innerHeight: window.innerHeight,
					timestamp: Date.now(),
				});
				timeout = null;
			}, DEBOUNCE_TIMEOUT);
		};

		window.addEventListener('resize', resizeHandler);
		this.eventListeners.set('window.resize', resizeHandler);
	}

	private setupScrollListener(elementId: string) {
		const element = document.getElementById(elementId);

		if (null === element) {
			return;
		}

		let timeout: number | null = null;

		const scrollHandler = (event: Event) => {
			if (null !== timeout) {
				window.clearTimeout(timeout);
			}

			timeout = window.setTimeout(() => {
				const target = event.target as Element;

				this.routerOutletScroll.set({
					type: 'scroll',
					elementId,
					scrollTop: target.scrollTop,
					scrollLeft: target.scrollLeft,
					scrollHeight: target.scrollHeight,
					scrollWidth: target.scrollWidth,
					timestamp: Date.now(),
				});
			}, DEBOUNCE_TIMEOUT);
		};

		element.addEventListener('scroll', scrollHandler);
		this.eventListeners.set(`${elementId}.scroll`, scrollHandler);
	}
}
