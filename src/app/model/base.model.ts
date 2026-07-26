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
