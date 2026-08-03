import { MikroORM } from '@mikro-orm/postgresql';

import { integrationMikroOrmConfig } from './integration-mikro-orm.config';

export default async function setup(): Promise<void> {
	if ('test' !== process.env['NODE_ENV']) {
		throw new Error(
			`Refusing to reset the schema: NODE_ENV is '${process.env['NODE_ENV'] ?? 'undefined'}', not 'test'.`,
		);
	}

	const orm = await MikroORM.init(integrationMikroOrmConfig());

	await orm.schema.dropSchema({ dropMigrationsTable: true });
	await orm.migrator.up();
	await orm.close();
}
