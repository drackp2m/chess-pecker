import { readFileSync } from 'node:fs';

import { INestApplication, Logger, NestApplicationOptions, ValidationPipe } from '@nestjs/common';
import { GlobalPrefixOptions } from '@nestjs/common/interfaces';

import { ConfigurationService } from '../module/config/configuration.service';
import { ApiConfig } from '../module/config/definition/api-config.type';

import { HttpExceptionFilter } from './exception-filter';

export class BootstrapHelper {
	static readonly validationPipe = new ValidationPipe({
		whitelist: true,
		transform: true,
	});

	static readonly exceptionsFilter = new HttpExceptionFilter();

	static readonly globalPrefix = (
		appConfig: ApiConfig,
	): [prefix: string, options?: GlobalPrefixOptions] => {
		return [appConfig.prefix, { exclude: ['', 'api'] }];
	};

	static readonly nestApplicationOptions = (appConfig: ApiConfig): NestApplicationOptions => {
		const nestApplicationOptions: NestApplicationOptions = {};

		if ('production' !== appConfig.environment && 'https' === appConfig.protocol) {
			nestApplicationOptions.httpsOptions = {
				key: readFileSync('../../.cert/key.pem'),
				cert: readFileSync('../../.cert/cert.pem'),
			};
		}

		return nestApplicationOptions;
	};

	static readonly apiConfig = (app: INestApplication): ApiConfig => {
		const configService = app.get(ConfigurationService);

		return { ...configService.api, port: 3000 };
	};

	static readonly logAppBootstrap = (appConfig: ApiConfig): void => {
		const isProduction = 'production' === appConfig.environment;
		const port = isProduction ? '' : `:${String(appConfig.port)}`;

		const url = `${appConfig.protocol}://${appConfig.domain}${port}`;
		const uptime = process.uptime().toFixed(3);
		const exposedPortInfo = isProduction ? ` and exposed on port ${String(appConfig.port)}` : '';

		Logger.log(`🚀 API ready at ${url} in ${uptime}s` + exposedPortInfo, 'Bootstrap');
	};
}
