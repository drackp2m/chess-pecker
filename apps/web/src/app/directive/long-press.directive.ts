import { Directive, ElementRef, OnDestroy, computed, inject, output, signal } from '@angular/core';

import { LONG_PRESS_MS, LONG_PRESS_TOLERANCE_PX } from '@app/definition/long-press.constant';

interface PressOrigin {
	readonly x: number;
	readonly y: number;
}

/**
 * A second action on the same control, reached by holding it. The two presses are told
 * apart here and not by the host, which only says what each one does.
 */
@Directive({
	selector: '[appLongPress]',
	host: {
		'[class.holding]': 'isHolding()',
		'[style.--long-press-duration]': 'duration()',
		'(pointerdown)': 'onPointerDown($event)',
		'(pointermove)': 'onPointerMove($event)',
		'(pointerup)': 'onPointerUp()',
		'(pointercancel)': 'cancel()',
		'(pointerleave)': 'cancel()',
		'(contextmenu)': 'onContextMenu($event)',
		'(click)': 'onClick()',
	},
})
export class LongPressDirective implements OnDestroy {
	readonly longPress = output();
	readonly shortPress = output();

	private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

	private readonly holding = signal(false);

	readonly isHolding = this.holding.asReadonly();

	/** Handed to CSS so whatever is drawn while holding lasts exactly as long as the wait. */
	readonly duration = computed(() => `${LONG_PRESS_MS.toString()}ms`);

	private origin: PressOrigin | null = null;
	private timer: ReturnType<typeof setTimeout> | null = null;
	private held = false;
	private fromPointer = false;

	ngOnDestroy(): void {
		this.clearTimer();
	}

	onPointerDown(event: PointerEvent): void {
		if (this.isInert()) {
			return;
		}

		this.cancel();
		this.origin = { x: event.clientX, y: event.clientY };
		this.held = false;
		this.holding.set(true);
		this.timer = setTimeout(() => {
			this.activate();
		}, LONG_PRESS_MS);
	}

	onPointerMove(event: PointerEvent): void {
		if (null !== this.timer && this.travelled(event)) {
			this.cancel();
		}
	}

	onPointerUp(): void {
		if (this.isInert()) {
			this.cancel();

			return;
		}

		const wasWaiting = null !== this.timer;

		this.clearTimer();
		this.holding.set(false);
		// A press the pointer already answered must not be answered again by the click that
		// follows it, which the browser sends anyway.
		this.fromPointer = wasWaiting || this.held;

		if (wasWaiting) {
			this.shortPress.emit();
		}

		this.origin = null;
	}

	/** The keyboard sends a click and no pointer at all, and it is always a short press. */
	onClick(): void {
		if (this.isInert()) {
			return;
		}

		if (this.fromPointer) {
			this.fromPointer = false;

			return;
		}

		this.shortPress.emit();
	}

	/** Holding on a touch screen offers to select or to open a menu, and neither is wanted. */
	onContextMenu(event: Event): void {
		if (this.held || null !== this.timer) {
			event.preventDefault();
		}
	}

	cancel(): void {
		this.clearTimer();
		this.holding.set(false);
		this.origin = null;
	}

	private isInert(): boolean {
		const element = this.host.nativeElement;

		return element.matches(':disabled') || 'true' === element.getAttribute('aria-disabled');
	}

	private activate(): void {
		this.timer = null;
		this.holding.set(false);

		if (this.isInert()) {
			return;
		}

		this.held = true;
		this.longPress.emit();
	}

	private travelled(event: PointerEvent): boolean {
		const origin = this.origin;

		if (null === origin) {
			return true;
		}

		return (
			LONG_PRESS_TOLERANCE_PX < Math.abs(event.clientX - origin.x) ||
			LONG_PRESS_TOLERANCE_PX < Math.abs(event.clientY - origin.y)
		);
	}

	private clearTimer(): void {
		if (null !== this.timer) {
			clearTimeout(this.timer);
			this.timer = null;
		}
	}
}
