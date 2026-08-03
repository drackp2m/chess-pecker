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
	// Let MikroORM auto-detect ts-node: under the migration CLI it picks
	// `entitiesTs`, under plain `node dist/main` it picks `entities`.
	// Forcing `preferTs/tsNode` made the runtime try to load the .ts sources and crash.
	//
	// NOTE: `autoLoadEntities` (a Nest-only option) would register the same
	// entities a second time on top of these globs -> "Duplicate entity names".
	// The globs are the single source of truth for both Nest and the CLI.
	extensions: [Migrator],
	entities: ['dist/module/**/*.entity.js'],
	entitiesTs: ['src/module/**/*.entity.ts'],
	namingStrategy: MikroOrmNamingStrategy,
	migrations: {
		tableName: 'migrations',
		// Same auto-detection rationale as `entities` above: the `migrations`
		// folder only holds .ts sources. `tsconfig.migrations.json` compiles them
		// to dist/migrations so `mikro-orm migration:up` has somewhere to look
		// once ts-node isn't installed (production `pnpm install --prod` deps).
		path: 'production' === process.env['NODE_ENV'] ? 'dist/migrations' : 'migrations',
		pathTs: 'migrations',
		silent: true,
	},
});
