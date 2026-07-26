import { ApplicationConfig, inject, isDevMode, provideAppInitializer } from '@angular/core';
import { TitleStrategy, provideRouter, withHashLocation, withRouterConfig } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';

import { APP_ROUTES } from '@app/app.routes';
import { SettingRepository } from '@app/repository/setting.repository';
import { ThemeService } from '@app/service/theme.service';
import { UpdateService } from '@app/service/update.service';
import { TemplatePageTitleStrategy } from '@app/strategy/template-file-title.strategy';

export const appConfig: ApplicationConfig = {
	providers: [
		SettingRepository,
		provideAppInitializer(() => {
			const _themeService = inject(ThemeService);
			const _updateService = inject(UpdateService);
		}),
		provideRouter(
			APP_ROUTES,
			withHashLocation(),
			withRouterConfig({
				paramsInheritanceStrategy: 'always',
				onSameUrlNavigation: 'reload',
			}),
		),
		{ provide: TitleStrategy, useClass: TemplatePageTitleStrategy },
		provideServiceWorker('ngsw-worker.js', {
			enabled: !isDevMode(),
			registrationStrategy: 'registerWhenStable:2000',
		}),
	],
};
