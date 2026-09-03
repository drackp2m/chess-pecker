import { type EntityManager, MikroORM, type PostgreSqlDriver } from '@mikro-orm/postgresql';

import { integrationMikroOrmConfig } from './integration-mikro-orm.config';

export default async function setup(): Promise<void> {
	if ('test' !== process.env['NODE_ENV']) {
		throw new Error(
			`Refusing to reset the schema: NODE_ENV is '${process.env['NODE_ENV'] ?? 'undefined'}', not 'test'.`,
		);
	}

	const orm = await MikroORM.init<PostgreSqlDriver, EntityManager>(integrationMikroOrmConfig());

	await orm.schema.drop({ dropMigrationsTable: true });
	await orm.migrator.up();
	await orm.close();
}
