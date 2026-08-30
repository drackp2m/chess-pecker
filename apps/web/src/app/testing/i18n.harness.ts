import { Injectable, Provider, signal } from '@angular/core';
import { Translation, TranslocoLoader, provideTransloco } from '@jsverse/transloco';
import { Observable, of } from 'rxjs';

import { DEFAULT_LANGUAGE, LANGUAGES } from '@app/definition/language.type';
import { DEFAULT_GENDER } from '@app/definition/model/setting/gender.type';
import { GenderService } from '@app/service/gender.service';

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
			availableLangs: [...LANGUAGES],
			defaultLang: DEFAULT_LANGUAGE,
			missingHandler: { logMissingKey: false },
		},
		loader: EmptyTranslationLoader,
	}),
	{
		provide: GenderService,
		useValue: { selectedGender: signal(DEFAULT_GENDER).asReadonly() },
	},
];
