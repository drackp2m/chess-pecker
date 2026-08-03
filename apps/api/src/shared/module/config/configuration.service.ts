import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { ApiConfig } from './definition/api-config.type';
import { DatabaseConfig } from './definition/database-config.type';
import { JwtConfig } from './definition/jwt-config.type';

@Injectable()
export class ConfigurationService {
	constructor(private readonly configService: ConfigService) {}

	get database(): DatabaseConfig {
		return this.configService.getOrThrow<DatabaseConfig>('database');
	}

	get api(): ApiConfig {
		return this.configService.getOrThrow<ApiConfig>('api');
	}

	get jwt(): JwtConfig {
		return this.configService.getOrThrow<JwtConfig>('jwt');
	}
}
