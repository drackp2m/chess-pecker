const resetDelayMs = 1000;

/**
 * Keystroke accumulator for non-searchable selects (native-select style
 * type-ahead): consecutive printable keys build a query until the user
 * pauses longer than the reset delay, which starts a fresh one.
 */
export class SelectTypeahead {
	private buffer = '';
	private lastKeyTime = 0;

	/**
	 * Whether a query is still building — a space must then join it
	 * ("new york") instead of toggling the dropdown.
	 */
	get isActive(): boolean {
		return '' !== this.buffer && Date.now() - this.lastKeyTime <= resetDelayMs;
	}

	/**
	 * Appends the key to the active query — or starts a new one after a
	 * pause — and returns the resulting query.
	 */
	capture(key: string): string {
		this.buffer = this.isActive ? this.buffer + key : key;
		this.lastKeyTime = Date.now();

		return this.buffer;
	}
}
