import { BaseEntity, Entity, PrimaryKey, Property } from '@mikro-orm/core';
import type { EntityData } from '@mikro-orm/core';

import { GenerateNowDateUseCase } from '../use-case/generate-now-date.use-case';
import { GenerateUuidUseCase } from '../use-case/generate-uuid.use-case';

@Entity({ abstract: true })
export abstract class CustomBaseEntity<T extends CustomBaseEntity<T>> extends BaseEntity {
	@PrimaryKey()
	uuid: string = new GenerateUuidUseCase().execute();

	@Property()
	createdAt: Date = new GenerateNowDateUseCase().execute();

	@Property({ onUpdate: () => new GenerateNowDateUseCase().execute() })
	updatedAt: Date = new GenerateNowDateUseCase().execute();

	constructor(init?: EntityData<T>) {
		super();

		if (undefined !== init) {
			Object.assign(this, init);
		}
	}
}
