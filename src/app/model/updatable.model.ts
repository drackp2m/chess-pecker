import { BaseModel } from '@app/model/base.model';

export abstract class UpdatableModel<T extends object> extends BaseModel<T> {
	updatedAt!: Date;

	constructor() {
		super();
		this.updatedAt = this.createdAt;
	}

	with(changes: Partial<T>): this {
		return UpdatableModel.update(this, changes);
	}

	static update<M extends UpdatableModel<T>, T extends object>(
		instance: M,
		changes: Partial<T>,
	): M {
		return Object.assign(
			Object.create(Object.getPrototypeOf(instance) as object),
			instance,
			changes,
			{
				updatedAt: new Date(),
			},
		) as M;
	}
}
