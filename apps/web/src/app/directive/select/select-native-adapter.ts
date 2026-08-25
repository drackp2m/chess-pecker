/**
 * Wraps the reads and writes the directive needs on the native `<select>`, including the
 * synthetic `change` a programmatic `.value` write does not fire on its own.
 */
export class SelectNativeAdapter {
	private optionsObserver: MutationObserver | null = null;

	constructor(private readonly selectElement: HTMLSelectElement) {}

	/**
	 * Watches the projected options, scanned only once at init, so late or relabelled ones
	 * still reach the store. Property-only writes stay invisible to a MutationObserver.
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
	 * Prepends a placeholder when no option carries an empty value, so the field can start
	 * unset. It only becomes the selection when nothing was explicitly pre-selected.
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
	 * Replaces the `value` accessor with a notifying wrapper: programmatic writes update the
	 * DOM without firing anything, so the setter is the only place to observe them.
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
	 * The select still carries the form value but owns no interaction, so it has to be
	 * unreachable for both Tab and assistive technology.
	 */
	hide(): void {
		this.selectElement.tabIndex = -1;
		this.selectElement.setAttribute('aria-hidden', 'true');
	}
}
