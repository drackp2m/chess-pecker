import { DOCUMENT, Directive, ElementRef, OnDestroy, inject, input, output } from '@angular/core';

import { LONG_PRESS_MS, LONG_PRESS_TOLERANCE_PX } from '@app/definition/long-press.constant';

interface TouchOrigin {
	readonly x: number;
	readonly y: number;
}

@Directive({
	selector: '[appTouchScrub]',
	host: {
		'(touchstart)': 'onTouchStart($event)',
		'(touchmove)': 'onTouchMove($event)',
		'(touchend)': 'onTouchEnd($event)',
		'(touchcancel)': 'onTouchCancel()',
		'(document:pointerdown)': 'onPointerDown($event)',
	},
})
export class TouchScrubDirective implements OnDestroy {
	readonly appTouchScrub = input.required<string>();

	readonly touchScrub = output<HTMLElement | null>();
	readonly touchScrubPin = output<HTMLElement | null>();

	private readonly document = inject(DOCUMENT);
	private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

	private target: HTMLElement | null = null;
	private pressed: HTMLElement | null = null;
	private origin: TouchOrigin | null = null;
	private timer: ReturnType<typeof setTimeout> | null = null;
	private scrubbing = false;

	ngOnDestroy(): void {
		this.clearTimer();
	}

	onTouchStart(event: TouchEvent): void {
		const touch = event.touches[0];

		if (1 < event.touches.length || undefined === touch) {
			this.cancelPress();

			return;
		}

		this.origin = { x: touch.clientX, y: touch.clientY };
		this.pressed = this.elementUnder(touch);
		this.clearTimer();
		this.timer = setTimeout(() => {
			this.activate();
		}, LONG_PRESS_MS);
	}

	onTouchMove(event: TouchEvent): void {
		const touch = event.touches[0];

		if (1 < event.touches.length || undefined === touch) {
			this.cancelPress();

			return;
		}

		if (!this.scrubbing) {
			if (this.travelled(touch)) {
				this.cancelPress();
			}

			return;
		}

		if (event.cancelable) {
			event.preventDefault();
		}

		this.track(touch);
	}

	onTouchEnd(event: TouchEvent): void {
		if (0 < event.touches.length) {
			return;
		}

		const scrubbed = this.scrubbing;
		const tapped = !scrubbed && null !== this.timer;
		const released = scrubbed ? this.target : this.pressed;

		if (scrubbed || tapped) {
			if (event.cancelable) {
				event.preventDefault();
			}

			this.touchScrubPin.emit(released);
		}

		this.cancelPress();
	}

	onTouchCancel(): void {
		this.cancelPress();
	}

	onPointerDown(event: PointerEvent): void {
		const target = event.target;
		const outside = !(target instanceof Node) || !this.host.nativeElement.contains(target);

		if (outside) {
			this.touchScrubPin.emit(null);
		}
	}

	private activate(): void {
		this.timer = null;
		this.scrubbing = true;
		this.emit(this.pressed);
	}

	private travelled(touch: Touch): boolean {
		const origin = this.origin;

		if (null === origin) {
			return true;
		}

		return (
			LONG_PRESS_TOLERANCE_PX < Math.abs(touch.clientX - origin.x) ||
			LONG_PRESS_TOLERANCE_PX < Math.abs(touch.clientY - origin.y)
		);
	}

	private track(touch: Touch): void {
		this.emit(this.elementUnder(touch));
	}

	private elementUnder(touch: Touch): HTMLElement | null {
		const under = this.document.elementFromPoint(touch.clientX, touch.clientY);
		const found = under?.closest(this.appTouchScrub()) ?? null;

		return found instanceof HTMLElement && this.host.nativeElement.contains(found) ? found : null;
	}

	private cancelPress(): void {
		this.clearTimer();
		this.origin = null;
		this.pressed = null;

		if (this.scrubbing) {
			this.scrubbing = false;
			this.emit(null);
		}
	}

	private clearTimer(): void {
		if (null !== this.timer) {
			clearTimeout(this.timer);
			this.timer = null;
		}
	}

	private emit(target: HTMLElement | null): void {
		if (target === this.target) {
			return;
		}

		this.target = target;
		this.touchScrub.emit(target);
	}
}
