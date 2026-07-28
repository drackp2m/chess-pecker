import { MikroOrmModuleOptions, MikroOrmOptionsFactory } from '@mikro-orm/nestjs';
import { Injectable } from '@nestjs/common';

import mikroOrmConfig from '../mikro-orm.config';

@Injectable()
export class MikroOrmFactory implements MikroOrmOptionsFactory {
	createMikroOrmOptions(_contextName?: string): MikroOrmModuleOptions {
		return mikroOrmConfig();
	}
}
