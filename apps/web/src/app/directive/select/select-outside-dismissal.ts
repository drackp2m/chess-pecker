import { SelectStore } from '@app/directive/select/select.store';

export interface SelectOutsideDismissalHooks {
	isInsideShell: (target: Node) => boolean;
	closeDropdown: () => void;
}

/**
 * Window listeners live only while the dropdown is open: the pointerdown that dismisses it,
 * and the mouse activity deciding whether hovering may take the highlight back.
 */
export class SelectOutsideDismissal {
	private lastMousePosition: { x: number; y: number } | null = null;

	constructor(
		private readonly store: SelectStore,
		private readonly hooks: SelectOutsideDismissalHooks,
	) {}

	attach(): void {
		this.lastMousePosition = null;

		window.addEventListener('pointerdown', this.onPointerDown, { capture: true });
		// Capture phase, so the echo check below runs before the options'
		// own mousemove hover handlers.
		window.addEventListener('mousemove', this.onMouseMove, { capture: true });
	}

	detach(): void {
		window.removeEventListener('pointerdown', this.onPointerDown, { capture: true });
		window.removeEventListener('mousemove', this.onMouseMove, { capture: true });
	}

	/**
	 * Native popup dismissal: the closing pointerdown is swallowed in the capture phase, so it
	 * neither moves focus nor activates whatever sits under the pointer.
	 */
	private readonly onPointerDown = (event: PointerEvent): void => {
		if (this.hooks.isInsideShell(event.target as Node)) {
			return;
		}

		event.preventDefault();
		event.stopPropagation();
		this.swallowNextClick();
		this.hooks.closeDropdown();
	};

	/**
	 * A swallowed pointerdown still produces a click, so that is consumed too. Disarmed by the
	 * next pointerdown in case the click never fires.
	 */
	private swallowNextClick(): void {
		const controller = new AbortController();
		const { signal } = controller;

		window.addEventListener(
			'click',
			(event) => {
				event.preventDefault();
				event.stopPropagation();
				controller.abort();
			},
			{ capture: true, signal },
		);
		window.addEventListener(
			'pointerdown',
			() => {
				controller.abort();
			},
			{ capture: true, signal },
		);
	}

	private readonly onMouseMove = (event: MouseEvent): void => {
		if (!this.store.isOpen()) {
			return;
		}

		if (this.isMouseEcho(event)) {
			return;
		}

		if (null !== (event.target as HTMLElement).closest('.option')) {
			return;
		}

		this.store.clearHighlight();
	};

	/**
	 * A keyboard-driven scroll makes the browser re-synthesise a mousemove at the unchanged
	 * position, so only changed coordinates release the keyboard's hold on the highlight.
	 */
	private isMouseEcho(event: MouseEvent): boolean {
		const last = this.lastMousePosition;

		this.lastMousePosition = { x: event.clientX, y: event.clientY };

		if (!this.store.keyboardNavigating()) {
			return false;
		}

		if (null !== last && (last.x !== event.clientX || last.y !== event.clientY)) {
			this.store.setKeyboardNavigating(false);

			return false;
		}

		return true;
	}
}
