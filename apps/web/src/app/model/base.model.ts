// ToDo => the prototype survives its boundaries by convention, not construction: one
// `updateEntity` call brings the bug back. Decide between tested invariants and plain data.

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
