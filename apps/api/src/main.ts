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

	const app = await NestFactory.create<NestExpressApplication>(
		AppModule,
		BootstrapHelper.nestApplicationOptions(apiConfig),
	);

	useContainer(app.select(AppModule), { fallbackOnErrors: true });

	// Express' default 100kb is well under a puzzle import batch: 5000 puzzles is close to 1MB.
	app.useBodyParser('json', { limit: '2mb' });

	app.setGlobalPrefix(...BootstrapHelper.globalPrefix(apiConfig));
	app.useGlobalPipes(BootstrapHelper.validationPipe);
	app.useGlobalFilters(BootstrapHelper.exceptionsFilter);
	app.enableCors(BootstrapHelper.corsOptions(apiConfig));
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
