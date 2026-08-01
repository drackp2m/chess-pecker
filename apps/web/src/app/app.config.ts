import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, inject, isDevMode, provideAppInitializer } from '@angular/core';
import { TitleStrategy, provideRouter, withHashLocation, withRouterConfig } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';

import { APP_ROUTES } from '@app/app.routes';
import { authInterceptor } from '@app/interceptor/auth.interceptor';
import { SettingRepository } from '@app/repository/setting.repository';
import { ThemeService } from '@app/service/theme.service';
import { UpdateService } from '@app/service/update.service';
import { SessionStore } from '@app/store/session.store';
import { TemplatePageTitleStrategy } from '@app/strategy/template-file-title.strategy';

export const appConfig: ApplicationConfig = {
	providers: [
		SettingRepository,
		provideHttpClient(withInterceptors([authInterceptor])),
		provideAppInitializer(() => {
			const _themeService = inject(ThemeService);
			const _updateService = inject(UpdateService);

			// The session restore is a background refresh, not a boot gate: the app
			// starts as `unknown` and whatever reads the store reacts when it settles,
			// so the initializer fires it without awaiting the result.
			void inject(SessionStore).restore();
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
