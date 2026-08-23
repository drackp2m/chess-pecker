import { SelectStore } from '@app/directive/select/select.store';

export interface SelectShellLayoutElements {
	wrapper: () => HTMLElement | undefined;
}

/**
 * The shell's layout: keeps `--label-width` and `--input-height` in step with the rendered
 * sizes, and decides whether the dropdown opens upwards.
 */
export class SelectShellLayout {
	private readonly coarsePointer = window.matchMedia('(pointer: coarse)').matches;

	constructor(
		private readonly store: SelectStore,
		private readonly elements: SelectShellLayoutElements,
	) {}

	/**
	 * The label width is not static — async translations, runtime language changes, late web
	 * fonts — so both sizes arrive as signals the shell keeps re-applying.
	 */
	applySizeVariables(labelWidth: number, wrapperHeight: number): void {
		const wrapperElement = this.elements.wrapper();

		if (undefined === wrapperElement) {
			return;
		}

		wrapperElement.style.setProperty('--label-width', `${labelWidth.toString()}px`);
		wrapperElement.style.setProperty('--input-height', `${wrapperHeight.toString()}px`);
	}

	/**
	 * A searchable field on a coarse pointer always opens upwards: the virtual keyboard scrolls
	 * the field into view and would fight a downward dropdown.
	 */
	isPositionedTop(): boolean {
		if (this.coarsePointer && this.store.searchable()) {
			return true;
		}

		const wrapperElement = this.elements.wrapper();

		if (undefined === wrapperElement) {
			return false;
		}

		const rect = wrapperElement.getBoundingClientRect();
		const viewportMidpoint = window.innerHeight / 2;
		const elementMidpoint = rect.top + rect.height / 2;

		return elementMidpoint >= viewportMidpoint;
	}
}
