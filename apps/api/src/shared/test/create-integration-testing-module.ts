import { ModuleMetadata } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { MikroOrmFactory } from '../module/config/factory/mikro-orm.factory';

import { integrationMikroOrmConfig } from './integration-mikro-orm.config';

export function createIntegrationTestingModule(metadata: ModuleMetadata): Promise<TestingModule> {
	return Test.createTestingModule(metadata)
		.overrideProvider(MikroOrmFactory)
		.useValue({ createMikroOrmOptions: integrationMikroOrmConfig })
		.compile();
}
