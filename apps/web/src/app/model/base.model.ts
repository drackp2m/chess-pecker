// ToDo => the prototype now survives the two boundaries that used to drop it — the
// repository rebuilds instances in `hydrate`, and `SettingStore` replaces entities
// with `setEntity` instead of merging them with `updateEntity` — but it survives by
// convention, not by construction: a single `updateEntity` call, or a repository that
// forgets to override `hydrate`, silently brings the bug back with the type still
// claiming otherwise. A backend adds a third boundary that flattens by definition,
// since JSON has no prototypes. Worth deciding before the model layer grows: keep
// classes and treat those rules as invariants worth a test, or move to plain readonly
// data with free functions, where the question cannot be asked.

export abstract class BaseModel<T extends object, C = unknown> {
	readonly uuid: string;
	readonly createdAt: Date;

	constructor() {
		this.uuid = crypto.randomUUID();
		this.createdAt = new Date();
	}

	toObject(): T {
		return Object.keys(this).reduce<Record<string, unknown>>((acc, key) => {
			acc[key] = this[key as keyof this];

			return acc;
		}, {}) as T;
	}

	protected computeAttributes?(): C;
}
