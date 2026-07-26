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
	 * Escape only belongs to the select while its dropdown is open — and then
	 * it must not leak further (one press closes a single layer, e.g. not
	 * also a surrounding modal). Closed, it passes through untouched.
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
	 * Space only toggles/confirms while the search box is empty; once the
	 * user is typing it stays a regular character, handled natively by the
	 * search input. Mid type-ahead it is one more character of the query
	 * ("new york"), not a toggle. But arrowing through the options declares
	 * the intent to pick one, and Space then confirms the highlight even
	 * mid-search / mid-type-ahead.
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
	 * Printable keys, minus modifier chords — which are left to the browser,
	 * except AltGr (reported as ctrl+alt), which is how several layouts type
	 * regular characters. Non-searchable fields turn them into type-ahead.
	 * Searchable ones let them reach the real search input natively while
	 * open; closed, the key opens the dropdown seeded with that character —
	 * the input still displays the selected value at that moment, so the
	 * default insertion must be suppressed.
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
	 * Native-select style type-ahead: the readonly input can't receive the
	 * text, so printable keys accumulate in a query that highlights the
	 * first matching option — opening the dropdown first when needed. The
	 * keyboard takes ownership of the highlight so the mousemove echo of
	 * the follow-up scroll can't hand it back to the mouse.
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
