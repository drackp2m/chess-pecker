import { inject } from '@angular/core';
import type { ResolveFn } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { firstValueFrom, forkJoin } from 'rxjs';

import type { I18nScope } from '@app/i18n';
import { LanguageService } from '@app/service/language.service';

/**
 * Holds the router on the view it is leaving until the scopes it is heading into are on
 * hand, so a page never paints its own keys and then swaps them for words. The wait starts
 * at the stored language rather than the default one, or the first load would fetch the
 * fallback, settle, and fetch again — the very repaint this is here to remove.
 *
 * A fetch that fails resolves anyway: a page showing its keys is a worse page, but a
 * navigation the router cancels is no page at all.
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
