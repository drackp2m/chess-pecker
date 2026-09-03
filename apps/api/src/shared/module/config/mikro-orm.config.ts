import { Migrator } from '@mikro-orm/migrations';
import { MikroOrmModuleSyncOptions } from '@mikro-orm/nestjs';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';

import { MikroOrmNamingStrategy } from './mikro-orm.naming-strategy';
import { databaseConfig } from './register/database-config';

const isProduction = 'production' === process.env['NODE_ENV'];

export default (): MikroOrmModuleSyncOptions => ({
	driver: PostgreSqlDriver,
	...databaseConfig(),
	allowGlobalContext: false,
	baseDir: process.cwd(),
	forceUtcTimezone: true,
	extensions: [Migrator],
	entities: ['dist/module/**/*.entity.js'],
	...(isProduction ? {} : { entitiesTs: ['src/module/**/*.entity.ts'] }),
	namingStrategy: MikroOrmNamingStrategy,
	migrations: {
		tableName: 'migrations',
		// Same rationale as `entities`. `tsconfig.migrations.json` compiles these to dist so
		// `migration:up` still has somewhere to look once ts-node is not installed.
		path: 'production' === process.env['NODE_ENV'] ? 'dist/migrations' : 'migrations',
		pathTs: 'migrations',
		silent: true,
	},
});
