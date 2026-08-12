import { DOCUMENT, Directive, ElementRef, inject, input, output } from '@angular/core';

@Directive({
	selector: '[appTouchScrub]',
	host: {
		'(touchstart)': 'onTouchStart($event)',
		'(touchmove)': 'onTouchMove($event)',
		'(touchend)': 'onTouchEnd($event)',
		'(touchcancel)': 'onTouchEnd($event)',
	},
})
export class TouchScrubDirective {
	readonly appTouchScrub = input.required<string>();

	readonly touchScrub = output<HTMLElement | null>();

	private readonly document = inject(DOCUMENT);
	private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

	private target: HTMLElement | null = null;
	private scrubbing = false;

	onTouchStart(event: TouchEvent): void {
		const touch = event.touches[0];

		if (1 < event.touches.length || undefined === touch) {
			this.stop();

			return;
		}

		this.scrubbing = true;
		this.track(touch);
	}

	onTouchMove(event: TouchEvent): void {
		const touch = event.touches[0];

		if (!this.scrubbing || 1 < event.touches.length || undefined === touch) {
			return;
		}

		if (event.cancelable) {
			event.preventDefault();
		}

		this.track(touch);
	}

	onTouchEnd(event: TouchEvent): void {
		if (0 === event.touches.length) {
			this.stop();
		}
	}

	private track(touch: Touch): void {
		const under = this.document.elementFromPoint(touch.clientX, touch.clientY);
		const found = under?.closest(this.appTouchScrub()) ?? null;
		const next =
			found instanceof HTMLElement && this.host.nativeElement.contains(found) ? found : null;

		this.emit(next);
	}

	private stop(): void {
		this.scrubbing = false;
		this.emit(null);
	}

	private emit(target: HTMLElement | null): void {
		if (target === this.target) {
			return;
		}

		this.target = target;
		this.touchScrub.emit(target);
	}
}
