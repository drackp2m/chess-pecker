/**
 * Wraps the native `<select>` element reads/writes the directive needs:
 * resolving its id, reading the currently selected text, checking whether
 * it has a value, and applying a new value while notifying reactive forms
 * via a synthetic `change` event (since setting `.value` programmatically
 * doesn't fire one on its own).
 */
export class SelectNativeAdapter {
	private optionsObserver: MutationObserver | null = null;

	constructor(private readonly selectElement: HTMLSelectElement) {}

	/**
	 * Watches the projected `<option>` list, which the directive only scans
	 * once at init: options rendered asynchronously or relabeled later would
	 * otherwise never reach the store. Text edits arrive as characterData
	 * mutations; note that property-only writes (e.g. `[value]` re-bound on
	 * a reused element) are invisible to a MutationObserver.
	 */
	observeOptionChanges(onChange: () => void): void {
		this.optionsObserver = new MutationObserver(() => {
			onChange();
		});

		this.optionsObserver.observe(this.selectElement, {
			subtree: true,
			childList: true,
			characterData: true,
			attributes: true,
			attributeFilter: ['value', 'disabled', 'selected', 'label'],
		});
	}

	stopObservingOptionChanges(): void {
		this.optionsObserver?.disconnect();
	}

	ensureId(fallbackId: string): string {
		if ('' === this.selectElement.id) {
			this.selectElement.id = fallbackId;
		}

		return this.selectElement.id;
	}

	/**
	 * When the select has no empty-valued option, prepends a generic
	 * placeholder so the field can start "unset". It only becomes the active
	 * selection when nothing was explicitly pre-selected (no `selected`
	 * attribute and no non-first option chosen), otherwise the existing
	 * selection is preserved.
	 */
	ensurePlaceholder(text: string): void {
		const options = Array.from(this.selectElement.options);

		if (options.some((option) => '' === option.value)) {
			return;
		}

		const hasPreselection =
			0 < this.selectElement.selectedIndex || (options[0]?.defaultSelected ?? false);

		this.selectElement.prepend(new Option(text, ''));

		if (!hasPreselection) {
			this.selectElement.value = '';
		}
	}

	/**
	 * Replaces the element's `value` accessor with a notifying wrapper:
	 * programmatic writes (reactive forms' `writeValue`, direct assignments)
	 * update the DOM without firing any event, so intercepting the setter is
	 * the only way to observe them.
	 */
	observeValueWrites(onWrite: () => void): void {
		const descriptor = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
		const { get, set } = descriptor ?? {};

		if (undefined === get || undefined === set) {
			return;
		}

		Object.defineProperty(this.selectElement, 'value', {
			configurable: true,
			get: (): string => get.call(this.selectElement) as string,
			set: (value: string): void => {
				set.call(this.selectElement, value);
				onWrite();
			},
		});
	}

	getValue(): string {
		return this.selectElement.value;
	}

	getSelectedText(): string {
		const selectedOption = this.selectElement.options[this.selectElement.selectedIndex];

		return selectedOption?.text ?? '';
	}

	isFilled(): boolean {
		return '' !== this.selectElement.value;
	}

	isDisabled(): boolean {
		return this.selectElement.disabled;
	}

	applyValue(value: string): void {
		this.selectElement.value = value;
		this.selectElement.dispatchEvent(new Event('change', { bubbles: true }));
	}

	/**
	 * The select keeps carrying the form value but plays no interactive role
	 * (the shell's combobox search input owns focus and keyboard), so it must
	 * be unreachable for both Tab and assistive technology.
	 */
	hide(): void {
		this.selectElement.tabIndex = -1;
		this.selectElement.setAttribute('aria-hidden', 'true');
	}
}
