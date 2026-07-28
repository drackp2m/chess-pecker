/**
 * Scroll behavior of the dropdown's options scroller. It works against the
 * live DOM rows (the list changes with the search filter) and relies on the
 * mandatory scroll snap to settle every movement on a row boundary.
 */
export class SelectDropdownScroller {
	constructor(private readonly getScroller: () => HTMLElement | undefined) {}

	applyRowHeight(rowIndex: number): void {
		const scroller = this.getScroller();

		if (undefined === scroller || 0 > rowIndex) {
			return;
		}

		const option = scroller.querySelectorAll<HTMLElement>('.option')[rowIndex];

		if (undefined === option) {
			return;
		}

		const height = option.getBoundingClientRect().height;

		scroller.style.setProperty('--option-height', `${height.toString()}px`);
	}

	/**
	 * Opening the dropdown starts the list centered on the highlighted option
	 * — the current selection, or the type-ahead match when a keystroke
	 * opened the dropdown — or back at the top when there is none.
	 */
	centerHighlighted(): void {
		const scroller = this.getScroller();

		if (undefined === scroller) {
			return;
		}

		const target =
			scroller.querySelector<HTMLElement>('.option.highlighted') ??
			scroller.querySelector<HTMLElement>('.option.selected');

		if (null === target) {
			scroller.scrollTop = 0;

			return;
		}

		scroller.scrollTop = this.centeredScrollTop(scroller, target);
	}

	/**
	 * Brings the highlighted row into view after a type-ahead jump —
	 * centered, but only when it isn't already fully visible.
	 */
	ensureHighlightVisible(highlightedIndex: number | null): void {
		const scroller = this.getScroller();

		if (undefined === scroller || null === highlightedIndex) {
			return;
		}

		const option = scroller.querySelectorAll<HTMLElement>('.option')[highlightedIndex];

		if (undefined === option) {
			return;
		}

		const isAbove = option.offsetTop < scroller.scrollTop;
		const isBelow =
			option.offsetTop + option.offsetHeight > scroller.scrollTop + scroller.clientHeight;

		if (isAbove || isBelow) {
			scroller.scrollTop = this.centeredScrollTop(scroller, option);
		}
	}

	/**
	 * Keeps a lookahead of two rows while navigating with the arrows: the
	 * scroll only moves once fewer than two options remain visible in the
	 * direction of travel, and then just enough to reveal the lookahead row.
	 */
	followHighlight(highlightedIndex: number | null, direction: 1 | -1): void {
		const scroller = this.getScroller();

		if (undefined === scroller || null === highlightedIndex) {
			return;
		}

		const options = scroller.querySelectorAll<HTMLElement>('.option');
		const lookaheadIndex = Math.min(
			Math.max(highlightedIndex + 2 * direction, 0),
			options.length - 1,
		);
		const lookahead = options[lookaheadIndex];

		if (undefined === lookahead) {
			return;
		}

		if (1 === direction) {
			const lookaheadBottom = lookahead.offsetTop + lookahead.offsetHeight;

			if (lookaheadBottom > scroller.scrollTop + scroller.clientHeight) {
				scroller.scrollTop = lookaheadBottom - scroller.clientHeight;
			}
		} else if (lookahead.offsetTop < scroller.scrollTop) {
			scroller.scrollTop = lookahead.offsetTop;
		}
	}

	private centeredScrollTop(scroller: HTMLElement, option: HTMLElement): number {
		return option.offsetTop - (scroller.clientHeight - option.offsetHeight) / 2;
	}
}
