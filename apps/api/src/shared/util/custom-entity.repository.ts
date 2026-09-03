import { Utils } from '@mikro-orm/core';
import type {
	EntityManager,
	EntityName,
	FilterQuery,
	FindOneOptions,
	FindOptions,
	Primary,
} from '@mikro-orm/core';

import { NotFoundException } from '../exception/not-found.exception';

import { CustomBaseEntity } from './custom-base.entity';

type RepositoryFindOptions<T, Hint extends string> = Omit<FindOptions<T, Hint>, 'using'>;
type RepositoryFindOneOptions<T, Hint extends string> = Omit<FindOneOptions<T, Hint>, 'using'>;

export class CustomRepository<T extends CustomBaseEntity<T>> {
	constructor(
		protected readonly entityManager: EntityManager,
		private readonly entityName: EntityName<T>,
	) {}

	getReference(id: Primary<T>): T {
		return this.entityManager.fork().getReference<T>(this.entityName, id);
	}

	async getOne<Hint extends string = never>(
		query: FilterQuery<T>,
		options?: RepositoryFindOneOptions<T, Hint>,
	): Promise<T> {
		const user = await this.entityManager.fork().findOne<T, Hint>(this.entityName, query, options);

		if (null === user) {
			const entityName = Utils.className(this.entityName).replace('Entity', '').toLocaleLowerCase();

			throw new NotFoundException('not exists', entityName);
		}

		return user;
	}

	async getMany<Hint extends string = never>(
		query: FilterQuery<T> = {},
		options?: RepositoryFindOptions<T, Hint>,
	): Promise<T[]> {
		return this.entityManager.fork().find<T, Hint>(this.entityName, query, options);
	}

	async insert(entity: T): Promise<T> {
		await this.entityManager.fork().persist(entity).flush();

		return entity;
	}

	/**
	 * An alias for `insert`: MikroORM picks insert or update from the entity itself. It exists
	 * so the use case can say what it means, not because it does anything different.
	 */
	async update(entity: T): Promise<T> {
		return this.insert(entity);
	}

	async delete(entity: T): Promise<void> {
		await this.entityManager.fork().remove(entity).flush();
	}

	async deleteMany(query: FilterQuery<T>): Promise<void> {
		await this.entityManager.fork().nativeDelete(this.entityName, query);
	}
}
