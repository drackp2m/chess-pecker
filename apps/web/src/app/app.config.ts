import { LocationStrategy } from '@angular/common';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, inject, isDevMode, provideAppInitializer } from '@angular/core';
import { TitleStrategy, provideRouter, withRouterConfig } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { provideTransloco } from '@jsverse/transloco';

import { APP_ROUTES } from '@app/app.routes';
import { DEFAULT_LANGUAGE, LANGUAGES } from '@app/definition/language.type';
import { authInterceptor } from '@app/interceptor/auth.interceptor';
import { SettingRepository } from '@app/repository/setting.repository';
import { LanguageService } from '@app/service/language.service';
import { ThemeService } from '@app/service/theme.service';
import { TranslocoLoaderService } from '@app/service/transloco-loader.service';
import { UpdateService } from '@app/service/update.service';
import { SessionStore } from '@app/store/session.store';
import { SyncStore } from '@app/store/sync.store';
import { SingleEntryLocationStrategy } from '@app/strategy/single-entry-location.strategy';
import { TemplatePageTitleStrategy } from '@app/strategy/template-file-title.strategy';
import { LocalOwnerUseCase } from '@app/use-case/local-owner.use-case';

export const appConfig: ApplicationConfig = {
	providers: [
		SettingRepository,
		provideHttpClient(withInterceptors([authInterceptor])),
		provideAppInitializer(() => {
			const _themeService = inject(ThemeService);
			const _languageService = inject(LanguageService);
			const _updateService = inject(UpdateService);
			const _localOwnerUseCase = inject(LocalOwnerUseCase);

			// The session restore is a background refresh and not a boot gate, so it is fired
			// without awaiting; the sync cycle behind it is the gate.
			const sessionStore = inject(SessionStore);
			const syncStore = inject(SyncStore);

			sessionStore.watch();
			syncStore.watch();

			void sessionStore.restore().then(() => syncStore.start());
		}),
		provideRouter(
			APP_ROUTES,
			withRouterConfig({
				paramsInheritanceStrategy: 'always',
				onSameUrlNavigation: 'reload',
			}),
		),
		provideTransloco({
			config: {
				availableLangs: [...LANGUAGES],
				defaultLang: DEFAULT_LANGUAGE,
				fallbackLang: DEFAULT_LANGUAGE,
				reRenderOnLangChange: true,
				prodMode: !isDevMode(),
			},
			loader: TranslocoLoaderService,
		}),
		{ provide: LocationStrategy, useClass: SingleEntryLocationStrategy },
		{ provide: TitleStrategy, useClass: TemplatePageTitleStrategy },
		provideServiceWorker('ngsw-worker.js', {
			enabled: !isDevMode(),
			registrationStrategy: 'registerWhenStable:2000',
		}),
	],
};
