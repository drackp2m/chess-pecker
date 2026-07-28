import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { useContainer } from 'class-validator';
import cookieParser from 'cookie-parser';

import { AppModule } from './module/app/app.module';
import { apiConfig as loadApiConfig } from './shared/module/config/register/api-config';
import { BootstrapHelper } from './shared/util/bootstrap.helper';

async function bootstrap(): Promise<void> {
	const apiConfig = loadApiConfig();

	const allowedDomains = apiConfig.corsAllowedDomains;
	const allowAnyOrigin = 'production' !== apiConfig.environment;

	const app = await NestFactory.create(
		AppModule,
		BootstrapHelper.nestApplicationOptions(apiConfig),
	);

	useContainer(app.select(AppModule), { fallbackOnErrors: true });

	app.setGlobalPrefix(...BootstrapHelper.globalPrefix(apiConfig));
	app.useGlobalPipes(BootstrapHelper.validationPipe);
	app.useGlobalFilters(BootstrapHelper.exceptionsFilter);
	app.enableCors({
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
		methods: 'GET,POST',
	});
	app.use(cookieParser(apiConfig.cookieSecret));

	const port = apiConfig.port;

	await app.listen(port, '0.0.0.0', () => {
		BootstrapHelper.logAppBootstrap(apiConfig);
	});
}

bootstrap().catch((e: unknown) => {
	const error = e instanceof Error ? e : new Error(String(e));

	Logger.error(error.message, error);
});
