import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { useContainer } from 'class-validator';
import cookieParser from 'cookie-parser';

import { AppModule } from './module/app/app.module';
import { apiConfig as loadApiConfig } from './shared/module/config/register/api-config';
import { BootstrapHelper } from './shared/util/bootstrap.helper';

async function bootstrap(): Promise<void> {
	const apiConfig = loadApiConfig();

	const allowedDomains = apiConfig.corsAllowedDomains;
	const allowAnyOrigin = 'production' !== apiConfig.environment;

	const app = await NestFactory.create<NestExpressApplication>(
		AppModule,
		BootstrapHelper.nestApplicationOptions(apiConfig),
	);

	useContainer(app.select(AppModule), { fallbackOnErrors: true });

	// Express' default body-parser limit (100kb) is well under what a puzzle import batch
	// needs: `ImportPuzzleRequestDto` allows up to 5000 puzzles per request, which serializes
	// to close to 1MB.
	app.useBodyParser('json', { limit: '2mb' });

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
		// FixMe => esta lista es a mano y no la vigila nada: un verbo que falte no rompe el
		// API, sólo el navegador, y en forma de preflight rechazado que no se parece a
		// "método no permitido". `friendship` y `training` ya usan PATCH y DELETE, y hasta
		// añadirlos aquí las respuestas llegaban correctas por curl y en blanco por la app.
		methods: 'GET,POST,PATCH,DELETE',
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
