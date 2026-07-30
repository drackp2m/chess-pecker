import { SelectStore } from '@app/directive/select/select.store';

export interface SelectOutsideDismissalHooks {
	isInsideShell: (target: Node) => boolean;
	closeDropdown: () => void;
}

/**
 * Window-level listeners active only while the dropdown is open: the
 * pointerdown outside the shell that dismisses it (swallowed so it stays
 * inert, like a native popup's) and the mouse activity that decides whether
 * hovering may take the highlight back from the keyboard.
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
	 * Mimics native popup dismissal: the pointerdown that closes the dropdown
	 * is swallowed before reaching its target (hence the capture phase), so
	 * it neither moves the focus nor activates whatever sits under the
	 * pointer — e.g. another select's shell.
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
	 * A swallowed pointerdown still produces a click; consume it too so the
	 * dismissing interaction stays inert end to end. Disarmed by the next
	 * pointerdown in case the click never fires (e.g. the pointer was
	 * dragged away before release).
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
	 * After a keyboard-driven scroll the browser re-synthesizes a mousemove
	 * at the unchanged pointer position to refresh the hover state. While
	 * the keyboard owns the highlight those echoes must not hand it back to
	 * the mouse — only an actual pointer movement (changed coordinates)
	 * releases the flag.
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
