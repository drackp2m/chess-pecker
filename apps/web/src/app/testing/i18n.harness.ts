import { Injectable, Provider } from '@angular/core';
import { Translation, TranslocoLoader, provideTransloco } from '@jsverse/transloco';
import { Observable, of } from 'rxjs';

@Injectable()
class EmptyTranslationLoader implements TranslocoLoader {
	getTranslation(): Observable<Translation> {
		return of({});
	}
}

/**
 * Nothing is translated under test: every key resolves to itself, so a template can be
 * queried by the key it renders instead of by a sentence that changes with the wording.
 */
export const provideTestingI18n = (): Provider[] => [
	provideTransloco({
		config: {
			availableLangs: ['es'],
			defaultLang: 'es',
			missingHandler: { logMissingKey: false },
		},
		loader: EmptyTranslationLoader,
	}),
];
