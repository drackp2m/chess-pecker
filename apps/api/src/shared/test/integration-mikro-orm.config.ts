import { MikroOrmModuleSyncOptions } from '@mikro-orm/nestjs';

import mikroOrmConfig from '../module/config/mikro-orm.config';

export function integrationMikroOrmConfig(): MikroOrmModuleSyncOptions {
	return {
		...mikroOrmConfig(),
		dynamicImportProvider: (id: string) => import(id),
	};
}
