import { inject } from '@angular/core';
import type { ResolveFn } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { firstValueFrom, forkJoin } from 'rxjs';

import type { I18nScope } from '@app/i18n';
import { LanguageService } from '@app/service/language.service';

/**
 * Holds the router on the old view until the scopes are on hand, starting from the stored
 * language so the fallback is not fetched first. A failed fetch resolves anyway.
 */
export function resolveI18n(...scopes: readonly I18nScope[]): ResolveFn<boolean> {
	return async () => {
		const languageService = inject(LanguageService);
		const transloco = inject(TranslocoService);

		await languageService.whenSettled;

		const language = languageService.selectedLanguage();
		const paths = [language, ...scopes.map((scope) => `${scope}/${language}`)];

		try {
			await firstValueFrom(forkJoin(paths.map((path) => transloco.load(path))));
		} catch (error: unknown) {
			console.error(`Could not load the translations for \`${paths.join('`, `')}\``, error);

			return false;
		}

		return true;
	};
}
