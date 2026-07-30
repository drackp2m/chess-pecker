import { EntityManager, FilterQuery, FindOneOptions, FindOptions, Primary } from '@mikro-orm/core';

import { NotFoundException } from '../exception/not-found.exception';

import { CustomBaseEntity } from './custom-base.entity';

export class CustomRepository<T extends CustomBaseEntity<T>> {
	constructor(
		// `protected` para que los repositorios que extienden esta clase puedan escribir
		// consultas que no encajan en los métodos genéricos de abajo (upserts, agregados).
		protected readonly entityManager: EntityManager,
		private readonly entityName: string,
	) {}

	getReference(id: Primary<T>): T {
		return this.entityManager.fork().getReference<T>(this.entityName, id);
	}

	async getOne<Hint extends string = never>(
		query: FilterQuery<T>,
		options?: FindOneOptions<T, Hint>,
	): Promise<T> {
		const user = await this.entityManager.fork().findOne(this.entityName, query, options);

		if (null === user) {
			const entityName = this.entityName.replace('Entity', '').toLocaleLowerCase();

			throw new NotFoundException('not exists', entityName);
		}

		return user;
	}

	async getMany<Hint extends string = never>(
		query: FilterQuery<T> = {},
		options?: FindOptions<T, Hint>,
	): Promise<T[]> {
		return this.entityManager.fork().find(this.entityName, query, options);
	}

	async insert(entity: T): Promise<T> {
		await this.entityManager.fork().persist(entity).flush();

		return entity;
	}

	/**
	 * Alias de `insert`, y funciona: MikroORM decide entre insert y update según si la
	 * entidad trae los datos con los que se cargó, aunque venga de otro fork. Existe para que
	 * el caso de uso diga qué pretende, no porque haga otra cosa.
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
