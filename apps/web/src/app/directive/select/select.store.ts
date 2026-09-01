import { Injectable, computed } from '@angular/core';
import { patchState, signalStore, withState } from '@ngrx/signals';

export interface SelectOptionViewModel {
	value: string;
	label: string;
	disabled: boolean;
	selected: boolean;
	highlighted: boolean;
}

interface SelectStoreProps {
	options: SelectOptionViewModel[];
	highlightedIndex: number | null;
	searchText: string;
	isOpen: boolean;
	focused: boolean;
	disabled: boolean;
	multiple: boolean;
	searchableOverride: boolean | null;
	keyboardNavigating: boolean;
	arrowNavigated: boolean;
}

const initialState: SelectStoreProps = {
	options: [],
	highlightedIndex: null,
	searchText: '',
	isOpen: false,
	focused: false,
	disabled: false,
	multiple: false,
	searchableOverride: null,
	keyboardNavigating: false,
	arrowNavigated: false,
};

const searchableOptionsThreshold = 12;

@Injectable()
export class SelectStore extends signalStore({ protectedState: false }, withState(initialState)) {
	readonly visibleOptions = computed<SelectOptionViewModel[]>(() => {
		const search = this.searchText().trim().toLowerCase();
		const highlightedIndex = this.highlightedIndex();

		return this.options()
			.filter(
				(option) =>
					'' === search || ('' !== option.value && option.label.toLowerCase().includes(search)),
			)
			.map((option, index) => ({ ...option, highlighted: index === highlightedIndex }));
	});

	readonly selectedOptions = computed<SelectOptionViewModel[]>(() =>
		this.options().filter((option) => option.selected),
	);

	readonly selectedText = computed<string>(() =>
		this.selectedOptions()
			.map((option) => option.label)
			.join(', '),
	);

	readonly filled = computed<boolean>(() => 0 < this.selectedOptions().length);

	readonly searchable = computed<boolean>(() => {
		const override = this.searchableOverride();

		if (null !== override) {
			return override;
		}

		const realOptions = this.options().filter((option) => '' !== option.value);

		return searchableOptionsThreshold < realOptions.length;
	});

	setMultiple(multiple: boolean): void {
		patchState(this, { multiple });
	}

	setSearchableOverride(searchableOverride: boolean | null): void {
		patchState(this, { searchableOverride });
	}

	setOptionsFromSelect(selectElement: HTMLSelectElement): void {
		const options: SelectOptionViewModel[] = Array.from(selectElement.options).map((option) => ({
			value: option.value,
			label: option.text,
			disabled: option.disabled,
			selected: '' !== option.value && option.selected,
			highlighted: false,
		}));

		patchState(this, { options });
	}

	updateSelection(values: string[]): void {
		patchState(this, {
			options: this.options().map((option) => ({
				...option,
				selected: '' !== option.value && values.includes(option.value),
			})),
		});
	}

	setFocused(focused: boolean): void {
		patchState(this, { focused });
	}

	setDisabled(disabled: boolean): void {
		patchState(this, { disabled });
	}

	openDropdown(): void {
		patchState(this, { isOpen: true });
		this.highlightInitialOption();
	}

	closeDropdown(): void {
		patchState(this, {
			isOpen: false,
			highlightedIndex: null,
			searchText: '',
			keyboardNavigating: false,
			arrowNavigated: false,
		});
	}

	/**
	 * While true the keyboard owns the highlight and hovers are ignored: set on arrow
	 * navigation, released when the pointer really moves.
	 */
	setKeyboardNavigating(keyboardNavigating: boolean): void {
		patchState(this, { keyboardNavigating });
	}

	/**
	 * Arrowing declares the intent to pick the highlight, so Space confirms it instead of
	 * being one more search character. Typing again withdraws that intent.
	 */
	moveHighlight(step: 1 | -1): void {
		patchState(this, { arrowNavigated: true });

		const visible = this.visibleOptions();
		const start = (this.highlightedIndex() ?? (1 === step ? -1 : visible.length)) + step;

		for (let index = start; 0 <= index && index < visible.length; index += step) {
			const option = visible[index];

			if (undefined !== option && !option.disabled) {
				this.highlightAt(index);

				return;
			}
		}
	}

	highlightFirstValidOption(): void {
		const index = this.visibleOptions().findIndex(
			(option) => '' !== option.value && !option.disabled,
		);

		this.highlightAt(index);
	}

	/**
	 * Highlights the first enabled option whose label starts with the query. A query with no
	 * match leaves the highlight untouched, like a native select.
	 */
	highlightTypeahead(query: string): void {
		patchState(this, { arrowNavigated: false });

		const search = query.toLowerCase();
		const index = this.visibleOptions().findIndex(
			(option) =>
				'' !== option.value && !option.disabled && option.label.toLowerCase().startsWith(search),
		);

		if (-1 !== index) {
			this.highlightAt(index);
		}
	}

	highlightAt(index: number): void {
		patchState(this, { highlightedIndex: -1 === index ? null : index });
	}

	clearHighlight(): void {
		patchState(this, { highlightedIndex: null });
	}

	confirmHighlightedOption(): SelectOptionViewModel | null {
		const highlighted = this.visibleOptions()[this.highlightedIndex() ?? -1];

		if (undefined === highlighted || highlighted.disabled) {
			return null;
		}

		return highlighted;
	}

	setSearchText(searchText: string): void {
		patchState(this, { searchText, arrowNavigated: false });
		this.highlightFirstMatch();
	}

	private highlightInitialOption(): void {
		const visible = this.visibleOptions();
		const selectedIndex = visible.findIndex((option) => option.selected && !option.disabled);
		const fallbackIndex = visible.findIndex((option) => !option.disabled);

		this.highlightAt(-1 !== selectedIndex ? selectedIndex : fallbackIndex);
	}

	private highlightFirstMatch(): void {
		const index = this.visibleOptions().findIndex((option) => !option.disabled);

		this.highlightAt(index);
	}
}
