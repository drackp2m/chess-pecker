import { SelectStore } from '@app/directive/select/select.store';

export interface SelectShellGestureHooks {
	hasTextSelection: () => boolean;
	requestToggle: () => void;
}

/**
 * Interprets the shell's raw pointer events into toggle requests. Direct
 * pointers (finger, stylus) defer to `click` — `pointerdown` fires before
 * the browser knows whether the gesture is a tap or a scroll — while
 * interactions inside the real search input stay fully native.
 */
export class SelectShellGestures {
	private togglesOnClick = false;
	private receivedPointerDown = false;

	constructor(
		private readonly store: SelectStore,
		private readonly hooks: SelectShellGestureHooks,
	) {}

	/**
	 * Skipping `preventDefault()` for direct pointers also lets the browser
	 * blur whatever element currently holds the focus.
	 */
	handlePointerDown(event: PointerEvent): void {
		this.receivedPointerDown = true;
		this.togglesOnClick = false;

		// Pointer interactions inside the real search input must stay fully
		// native (focus, caret placement, text selection); whether the
		// dropdown opens is decided on click.
		if (this.isInsideOptions(event.target) || this.isInsideSearchInput(event.target)) {
			return;
		}

		if ('touch' === event.pointerType || 'pen' === event.pointerType) {
			this.togglesOnClick = true;

			return;
		}

		event.preventDefault();
		this.hooks.requestToggle();
	}

	// The gesture turned into a scroll: no click will follow, so the pending
	// state must be discarded before the next interaction.
	handlePointerCancel(): void {
		this.receivedPointerDown = false;
		this.togglesOnClick = false;
	}

	/**
	 * Toggling from `click` covers two cases: direct-pointer taps (deferred
	 * from pointerdown once the gesture is known not to be a scroll) and
	 * clicks that arrive with no pointerdown at all — Safari suppresses only
	 * the pointerdown of the click that dismisses a native select popup,
	 * while assistive tech emits bare synthetic clicks.
	 */
	handleClick(event: MouseEvent): void {
		const togglesNow = this.togglesOnClick || !this.receivedPointerDown;

		this.receivedPointerDown = false;
		this.togglesOnClick = false;

		if (this.isInsideOptions(event.target)) {
			return;
		}

		// A click inside the search input only ever opens the dropdown
		// (closing it or moving the caret is native business) — and not when
		// the user just finished dragging a text selection to copy the value.
		if (this.isInsideSearchInput(event.target)) {
			if (!this.store.isOpen() && !this.hooks.hasTextSelection()) {
				this.hooks.requestToggle();
			}

			return;
		}

		if (togglesNow) {
			this.hooks.requestToggle();
		}
	}

	private isInsideOptions(target: EventTarget | null): boolean {
		return null !== (target as HTMLElement).closest('.app-select-options');
	}

	private isInsideSearchInput(target: EventTarget | null): boolean {
		return null !== (target as HTMLElement).closest('.search-input');
	}
}
