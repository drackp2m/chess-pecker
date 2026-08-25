import { Migrator } from '@mikro-orm/migrations';
import { MikroOrmModuleSyncOptions } from '@mikro-orm/nestjs';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';

import { MikroOrmNamingStrategy } from './mikro-orm.naming-strategy';
import { databaseConfig } from './register/database-config';

export default (): MikroOrmModuleSyncOptions => ({
	driver: PostgreSqlDriver,
	...databaseConfig(),
	allowGlobalContext: false,
	forceUtcTimezone: true,
	// Auto-detected on purpose: forcing `preferTs`/`tsNode` made the runtime load the .ts
	// sources and crash, and `autoLoadEntities` would register these globs a second time.
	extensions: [Migrator],
	entities: ['dist/module/**/*.entity.js'],
	entitiesTs: ['src/module/**/*.entity.ts'],
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
