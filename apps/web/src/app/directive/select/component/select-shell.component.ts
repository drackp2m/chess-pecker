import { NgTemplateOutlet } from '@angular/common';
import {
	Component,
	DestroyRef,
	ElementRef,
	HostListener,
	TemplateRef,
	afterNextRender,
	computed,
	effect,
	inject,
	input,
	output,
	signal,
	viewChild,
} from '@angular/core';

import { SvgComponent } from '@app/component/svg/svg.component';
import { SelectDropdownScroller } from '@app/directive/select/component/select-dropdown-scroller';
import { SelectShellGestures } from '@app/directive/select/component/select-shell-gestures';
import { SelectShellLayout } from '@app/directive/select/component/select-shell-layout';
import { SelectOptionViewModel, SelectStore } from '@app/directive/select/select.store';
import { ViewportService } from '@app/service/viewport.service';

/**
 * Themed shell rendered around the native `<select>` (projected via
 * `ng-content`). Reads the shared SelectStore directly and delegates its
 * concerns to plain collaborators: pointer gestures (SelectShellGestures),
 * CSS variable measuring and dropdown positioning (SelectShellLayout) and
 * dropdown scrolling (SelectDropdownScroller).
 *
 * Pointer events are handled at the host level. Focus, keyboard and text
 * rendering belong to the shell's own combobox search input; the projected
 * native select only carries the form value.
 */
@Component({
	selector: 'app-select-shell',
	templateUrl: './select-shell.component.html',
	imports: [SvgComponent, NgTemplateOutlet],
})
export class SelectShellComponent {
	readonly label = input.required<string>();
	readonly selectId = input.required<string>();
	readonly placeholder = input.required<string>();
	readonly maxVisibleOptions = input(9);
	readonly optionTemplate = input<TemplateRef<{ $implicit: SelectOptionViewModel }>>();

	readonly optionSelected = output<string>();
	readonly toggleRequested = output();
	readonly closeRequested = output();
	readonly searchKeydown = output<KeyboardEvent>();

	protected readonly store = inject(SelectStore);
	protected readonly positionTop = signal(false);
	protected readonly searchInputId = computed<string>(() => `${this.selectId()}-search`);
	protected readonly listboxId = computed<string>(() => `${this.selectId()}-listbox`);

	/**
	 * The field's single visible text: the live search while open (it always
	 * starts empty — the search is cleared on close), the selected option's
	 * text once closed, or nothing at all so the placeholder shows through.
	 * Non-searchable fields keep showing the selected text while open, since
	 * there is no search to make room for.
	 */
	protected readonly displayText = computed<string>(() => {
		if (this.store.isOpen() && this.store.searchable()) {
			return this.store.searchText();
		}

		return this.store.filled() ? this.store.selectedText() : '';
	});

	/**
	 * Screen-reader feedback while the dropdown is open: the custom listbox
	 * is a purely visual layer (hidden from the accessibility tree), so
	 * highlight movements are voiced through a polite live region instead.
	 */
	protected readonly announcement = computed<string>(() => {
		if (!this.store.isOpen()) {
			return '';
		}

		const options = this.store.visibleOptions();
		const highlightedIndex = options.findIndex((option) => option.highlighted);
		const highlighted = options[highlightedIndex];

		if (0 === options.length) {
			return 'No matches found';
		}

		if (undefined === highlighted) {
			return '';
		}

		return `${highlighted.label}, ${(highlightedIndex + 1).toString()} of ${options.length.toString()}`;
	});

	private readonly viewportService = inject(ViewportService);
	private readonly destroyRef = inject(DestroyRef);
	private readonly wrapper = viewChild<ElementRef<HTMLElement>>('wrapper');
	private readonly labelText = viewChild<ElementRef<HTMLElement>>('labelText');
	private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');
	private readonly optionsScroller = viewChild<ElementRef<HTMLElement>>('optionsScroller');

	private readonly gestures = new SelectShellGestures(this.store, {
		hasTextSelection: () => this.hasTextSelection(),
		requestToggle: () => {
			this.toggleRequested.emit();
		},
	});

	private readonly layout = new SelectShellLayout(this.store, {
		wrapper: () => this.wrapper()?.nativeElement,
		labelText: () => this.labelText()?.nativeElement,
	});

	private readonly dropdownScroller = new SelectDropdownScroller(
		() => this.optionsScroller()?.nativeElement,
	);

	constructor() {
		afterNextRender(() => {
			this.destroyRef.onDestroy(this.layout.observeSizeChanges());
		});

		effect(() => {
			this.store.isOpen();
			this.viewportService.routerOutletScroll();
			this.viewportService.windowResized();

			this.positionTop.set(this.layout.isPositionedTop());
		});

		effect(() => {
			if (!this.store.isOpen()) {
				return;
			}

			// The `.open` class reaches the DOM after this effect runs; wait a
			// frame so the dropdown has layout before measuring against it.
			requestAnimationFrame(() => {
				this.dropdownScroller.applyRowHeight(this.firstRealOptionIndex());
				this.dropdownScroller.centerHighlighted();
			});
		});
	}

	@HostListener('pointerdown', ['$event'])
	onWrapperPointerDown(event: PointerEvent): void {
		this.gestures.handlePointerDown(event);
	}

	@HostListener('pointercancel')
	onWrapperPointerCancel(): void {
		this.gestures.handlePointerCancel();
	}

	@HostListener('click', ['$event'])
	onWrapperClick(event: MouseEvent): void {
		this.gestures.handleClick(event);
	}

	focusSearchInput(): void {
		this.searchInput()?.nativeElement.focus();
	}

	selectOption(option: SelectOptionViewModel): void {
		if (!option.disabled) {
			this.optionSelected.emit(option.value);
		}
	}

	hoverOption(option: SelectOptionViewModel, index: number): void {
		// While the keyboard owns the highlight, hovers are ignored: the
		// capture-phase mousemove listener (SelectOutsideDismissal) has
		// already released the flag by now if the pointer really moved.
		if (this.store.keyboardNavigating() || option.disabled) {
			return;
		}

		this.store.highlightAt(index);
	}

	/**
	 * The keydown is handled synchronously by the directive's interaction
	 * handler during `emit`, so right after it the store already points at
	 * the new highlight and the scroll can follow it. Skipped when the arrow
	 * just opened the dropdown: the centering-on-open effect takes over.
	 */
	protected onSearchKeydown(event: KeyboardEvent): void {
		const wasOpen = this.store.isOpen();
		const previousHighlight = this.store.highlightedIndex();

		this.searchKeydown.emit(event);

		if (!wasOpen) {
			return;
		}

		if ('ArrowDown' === event.code) {
			this.dropdownScroller.followHighlight(this.store.highlightedIndex(), 1);
		} else if ('ArrowUp' === event.code) {
			this.dropdownScroller.followHighlight(this.store.highlightedIndex(), -1);
		} else if (this.store.highlightedIndex() !== previousHighlight) {
			// Type-ahead (and Tab) jumps can land anywhere in the list.
			this.dropdownScroller.ensureHighlightVisible(this.store.highlightedIndex());
		}
	}

	protected onSearchFocus(): void {
		this.store.setFocused(true);
	}

	protected onSearchBlur(): void {
		this.store.setFocused(false);
		this.closeRequested.emit();
	}

	protected onSearchInput(event: Event): void {
		const value = (event.target as HTMLInputElement).value;

		// Editing can also start while closed (paste, IME composition): the
		// dropdown must open — which clears the previous search — before the
		// new text lands in the store.
		if (!this.store.isOpen()) {
			this.toggleRequested.emit();
		}

		this.store.setSearchText(value);
	}

	private firstRealOptionIndex(): number {
		return this.store.visibleOptions().findIndex((option) => '' !== option.value);
	}

	private hasTextSelection(): boolean {
		const element = this.searchInput()?.nativeElement;

		return undefined !== element && element.selectionStart !== element.selectionEnd;
	}
}
