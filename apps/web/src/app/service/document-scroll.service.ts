import { Injectable, OnDestroy } from '@angular/core';

const SETTLE_DELAY = 150;
const KEYBOARD_THRESHOLD = 100;
const KEYBOARD_ATTRIBUTE = 'data-keyboard';
const KEYBOARD_INSET_PROPERTY = '--keyboard-inset';

const TEXT_ENTRY_INPUT_TYPES = new Set([
	'text',
	'search',
	'email',
	'password',
	'tel',
	'url',
	'number',
]);

@Injectable({
	providedIn: 'root',
})
export class DocumentScrollService implements OnDestroy {
	private readonly controller = new AbortController();
	private timeout: number | null = null;

	constructor() {
		const { signal } = this.controller;

		window.addEventListener('scroll', this.scheduleSettle, { passive: true, signal });
		window.visualViewport?.addEventListener('resize', this.onViewportResize, { signal });
		window.visualViewport?.addEventListener('scroll', this.scheduleSettle, { signal });
		document.addEventListener('focusout', this.scheduleSettle, { signal });
	}

	ngOnDestroy(): void {
		this.controller.abort();

		if (null !== this.timeout) {
			window.clearTimeout(this.timeout);
		}
	}

	private readonly onViewportResize = (): void => {
		const inset = keyboardInset();
		const root = document.documentElement;

		root.style.setProperty(KEYBOARD_INSET_PROPERTY, `${inset.toString()}px`);
		root.toggleAttribute(KEYBOARD_ATTRIBUTE, 0 < inset);

		if (0 < inset) {
			fitAboveKeyboard();
		} else {
			this.scheduleSettle();
		}
	};

	private readonly scheduleSettle = (): void => {
		if (null !== this.timeout) {
			window.clearTimeout(this.timeout);
		}

		this.timeout = window.setTimeout(this.settle, SETTLE_DELAY);
	};

	private readonly settle = (): void => {
		this.timeout = null;

		if (0 === window.scrollX && 0 === window.scrollY) {
			return;
		}

		if (0 < keyboardInset()) {
			fitAboveKeyboard();

			return;
		}

		if (hasTextEntryFocus()) {
			return;
		}

		window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
	};
}

function keyboardInset(): number {
	const viewport = window.visualViewport;

	if (1 !== viewport?.scale) {
		return 0;
	}

	const inset = Math.round(document.documentElement.clientHeight - viewport.height);

	return KEYBOARD_THRESHOLD > inset ? 0 : inset;
}

function fitAboveKeyboard(): void {
	window.scrollTo(0, 0);

	if (hasTextEntryFocus()) {
		document.activeElement?.scrollIntoView({ block: 'nearest' });
	}
}

function hasTextEntryFocus(): boolean {
	const element = document.activeElement;

	if (element instanceof HTMLTextAreaElement) {
		return !element.readOnly;
	}

	if (element instanceof HTMLInputElement) {
		return TEXT_ENTRY_INPUT_TYPES.has(element.type) && !element.readOnly;
	}

	return element instanceof HTMLElement && element.isContentEditable;
}
