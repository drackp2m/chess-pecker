import { readFileSync } from 'node:fs';

import { INestApplication, Logger, NestApplicationOptions, ValidationPipe } from '@nestjs/common';
import { GlobalPrefixOptions } from '@nestjs/common/interfaces';
import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

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

	static readonly corsOptions = (appConfig: ApiConfig): CorsOptions => {
		const allowedDomains = appConfig.corsAllowedDomains;
		const allowAnyOrigin = 'production' !== appConfig.environment;

		return {
			credentials: true,
			origin: (
				origin: string | undefined,
				callback: (error: Error | null, allowed: boolean) => void,
			) => {
				if (origin === undefined || allowAnyOrigin || allowedDomains.includes(origin)) {
					callback(null, true);
				} else {
					Logger.warn(`Origin ${origin} not allowed by CORS policy`);
					callback(null, false);
				}
			},
			// FixMe => esta lista es a mano y no la vigila nada: un verbo que falte no rompe el
			// API, sólo el navegador, y en forma de preflight rechazado que no se parece a
			// "método no permitido". `friendship` y `training` ya usan PATCH y DELETE, y hasta
			// añadirlos aquí las respuestas llegaban correctas por curl y en blanco por la app.
			methods: 'GET,POST,PATCH,DELETE',
		};
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
