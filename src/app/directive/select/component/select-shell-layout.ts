import { SelectStore } from '@app/directive/select/select.store';

export interface SelectShellLayoutElements {
	wrapper: () => HTMLElement | undefined;
	labelText: () => HTMLElement | undefined;
}

/**
 * Layout concerns of the shell: keeps the `--label-width` / `--input-height`
 * CSS variables in sync with the rendered sizes and decides whether the
 * dropdown should open upwards.
 */
export class SelectShellLayout {
	private readonly coarsePointer = window.matchMedia('(pointer: coarse)').matches;

	constructor(
		private readonly store: SelectStore,
		private readonly elements: SelectShellLayoutElements,
	) {}

	/**
	 * The label width is not static: translations resolve asynchronously, the
	 * language can change at runtime and web fonts reflow the text once they
	 * load. A ResizeObserver on the hidden measure span (and on the wrapper,
	 * for the height) re-measures on every such change — including the
	 * initial layout, since observers fire once on `observe()`. Returns the
	 * cleanup that disconnects the observer.
	 */
	observeSizeChanges(): () => void {
		const wrapperElement = this.elements.wrapper();
		const labelElement = this.elements.labelText();

		if (undefined === wrapperElement || undefined === labelElement) {
			return () => undefined;
		}

		const observer = new ResizeObserver(() => {
			this.applySizeVariables();
		});

		observer.observe(labelElement);
		observer.observe(wrapperElement);

		return () => {
			observer.disconnect();
		};
	}

	/**
	 * Coarse-pointer devices always open upwards while the field is
	 * searchable: focusing the editable input pops the virtual keyboard and
	 * the browser auto-scrolls the field into view, which would fight a
	 * downward dropdown. A read-only combobox never summons the keyboard, so
	 * it positions freely on the emptier viewport half.
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

	private applySizeVariables(): void {
		const wrapperElement = this.elements.wrapper();

		if (undefined === wrapperElement) {
			return;
		}

		const labelWidth = this.elements.labelText()?.offsetWidth ?? 0;

		wrapperElement.style.setProperty('--label-width', `${labelWidth.toString()}px`);
		wrapperElement.style.setProperty(
			'--input-height',
			`${wrapperElement.offsetHeight.toString()}px`,
		);
	}
}
