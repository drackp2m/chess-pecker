// ToDo => decide whether models stay classes at all. Nothing that leaves this layer
// keeps the prototype: IndexedDB structured-clones on write, `@ngrx/signals/entities`
// spreads on update, and a JSON backend would flatten it too — so `.with()` is only
// reliable on an instance you built yourself in the same tick. Plain readonly data
// plus free functions would model that honestly and stop the type system from
// promising methods that are not there at runtime.
//
// ToDo => `'with'` in this list never matches: it is a prototype method, so
// `Object.keys(this)` cannot return it. `'computed'` is not an own key either.
const OMITTED_KEYS = ['computed', 'with'];

export abstract class BaseModel<T extends object, C = unknown> {
	readonly uuid: string;
	readonly createdAt: Date;

	constructor() {
		this.uuid = crypto.randomUUID();
		this.createdAt = new Date();
	}

	toObject(): T {
		return Object.keys(this).reduce<Record<string, unknown>>((acc, key) => {
			if (!OMITTED_KEYS.includes(key)) {
				acc[key] = this[key as keyof this];
			}

			return acc;
		}, {}) as T;
	}

	protected computeAttributes?(): C;
}
