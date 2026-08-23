import { SelectTypeahead } from '@app/directive/select/select-typeahead';
import { SelectStore } from '@app/directive/select/select.store';

export interface SelectInteractionHooks {
	openDropdown: () => void;
	closeDropdown: () => void;
	selectOption: (value: string) => void;
}

/**
 * Translates the keydowns of the shell's search input into store updates
 * and dropdown actions. Holds no DOM or option state itself.
 */
export class SelectInteractionHandler {
	private readonly typeahead = new SelectTypeahead();

	constructor(
		private readonly store: SelectStore,
		private readonly hooks: SelectInteractionHooks,
	) {}

	handleKeydown(event: KeyboardEvent): void {
		switch (event.code) {
			case 'Enter':
				this.handleEnter(event);

				break;

			case 'Space':
				this.handleSpace(event);

				break;

			case 'Tab':
				this.handleTab(event);

				break;

			case 'Escape':
				this.handleEscape(event);

				break;

			case 'ArrowDown':
				this.handleArrow(event, 1);

				break;

			case 'ArrowUp':
				this.handleArrow(event, -1);

				break;

			default:
				this.handleSearchKey(event);
		}
	}

	/**
	 * Escape belongs to the select only while the dropdown is open, and must not leak: one
	 * press closes one layer. Closed, it passes through untouched.
	 */
	private handleEscape(event: KeyboardEvent): void {
		if (!this.store.isOpen()) {
			return;
		}

		event.preventDefault();
		event.stopPropagation();
		this.hooks.closeDropdown();
	}

	private handleEnter(event: KeyboardEvent): void {
		if (!this.store.isOpen()) {
			return;
		}

		event.preventDefault();
		this.confirmHighlighted();
	}

	/**
	 * Space only toggles while the search box is empty; typing keeps it a character ("new
	 * york"). Arrowing declares the intent to pick, so it confirms the highlight from then on.
	 */
	private handleSpace(event: KeyboardEvent): void {
		if (this.store.isOpen() && this.store.arrowNavigated()) {
			event.preventDefault();
			this.confirmHighlighted();

			return;
		}

		if ('' !== this.store.searchText()) {
			return;
		}

		if (!this.store.searchable() && this.typeahead.isActive) {
			this.handleTypeaheadKey(event);

			return;
		}

		event.preventDefault();

		if (this.store.isOpen()) {
			this.confirmHighlighted();
		} else {
			this.hooks.openDropdown();
		}
	}

	private handleTab(event: KeyboardEvent): void {
		if (!this.store.isOpen()) {
			return;
		}

		event.preventDefault();
		this.store.highlightFirstValidOption();
	}

	private handleArrow(event: KeyboardEvent, step: 1 | -1): void {
		event.preventDefault();

		if (this.store.isOpen()) {
			this.store.setKeyboardNavigating(true);
			this.store.moveHighlight(step);
		} else {
			this.hooks.openDropdown();
		}
	}

	/**
	 * Printable keys, minus modifier chords but including AltGr, which several layouts type
	 * ordinary characters with. Closed, the key opens the dropdown seeded with that character.
	 */
	private handleSearchKey(event: KeyboardEvent): void {
		const isAltGr = event.ctrlKey && event.altKey;
		const isShortcut = (event.ctrlKey || event.metaKey) && !isAltGr;

		if (1 !== event.key.length || isShortcut) {
			return;
		}

		if (!this.store.searchable()) {
			this.handleTypeaheadKey(event);

			return;
		}

		if (this.store.isOpen()) {
			return;
		}

		event.preventDefault();
		this.hooks.openDropdown();
		this.store.setSearchText(event.key);
	}

	/**
	 * Native-style type-ahead, since a readonly input cannot take the text. The keyboard takes
	 * the highlight so the scroll's mousemove echo cannot hand it back to the mouse.
	 */
	private handleTypeaheadKey(event: KeyboardEvent): void {
		event.preventDefault();

		const query = this.typeahead.capture(event.key);

		if (!this.store.isOpen()) {
			this.hooks.openDropdown();
		}

		this.store.setKeyboardNavigating(true);
		this.store.highlightTypeahead(query);
	}

	private confirmHighlighted(): void {
		const option = this.store.confirmHighlightedOption();

		if (null !== option) {
			this.hooks.selectOption(option.value);
		}
	}
}
