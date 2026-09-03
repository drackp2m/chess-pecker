import { readFileSync } from 'node:fs';

import {
	HttpStatus,
	INestApplication,
	Logger,
	NestApplicationOptions,
} from '@nestjs/common';
import { StandardSchemaValidationPipe } from '@nestjs/common/pipes';
import { GlobalPrefixOptions } from '@nestjs/common/interfaces';
import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import { NextFunction, Request, Response } from 'express';

import { ConfigurationService } from '../module/config/configuration.service';
import { ApiConfig } from '../module/config/definition/api-config.type';

import { HttpExceptionFilter } from './exception-filter';

export class BootstrapHelper {
	static readonly validationPipe = new StandardSchemaValidationPipe();

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
			methods: 'GET,POST,PUT,PATCH,DELETE',
			maxAge: 86400,
		};
	};

	static readonly payloadFilter = (
		error: unknown,
		request: Request,
		response: Response,
		next: NextFunction,
	): void => {
		if (!isPayloadTooLarge(error)) {
			next(error);

			return;
		}

		Logger.warn(`Payload over the ceiling on ${request.originalUrl}`, 'Bootstrap');

		response.status(HttpStatus.PAYLOAD_TOO_LARGE).json({
			message: { request: 'payload too large' },
			statusCode: HttpStatus.PAYLOAD_TOO_LARGE,
			ip: request.ip,
		});
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

function isPayloadTooLarge(error: unknown): boolean {
	if (null === error || 'object' !== typeof error) {
		return false;
	}

	return 'entity.too.large' === (error as { type?: unknown }).type;
}
