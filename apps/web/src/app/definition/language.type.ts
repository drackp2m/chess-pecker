export type Language = 'es-ES' | 'ca-ES' | 'en-GB' | 'ru-RU';

export const LANGUAGES: readonly Language[] = ['es-ES', 'ca-ES', 'en-GB', 'ru-RU'];

export const DEFAULT_LANGUAGE: Language = 'es-ES';

export const LANGUAGE_NAME = {
	'es-ES': 'Español',
	'ca-ES': 'Català',
	'en-GB': 'English',
	'ru-RU': 'Русский',
} as const satisfies Record<Language, string>;

export const LANGUAGE_FLAG = {
	'es-ES': 'svg/flag/es.svg',
	'ca-ES': 'svg/flag/es-ct.svg',
	'en-GB': 'svg/flag/gb.svg',
	'ru-RU': 'svg/flag/ru.svg',
} as const satisfies Record<Language, string>;

export function normalizeLanguage(value: unknown): Language {
	if (LANGUAGES.includes(value as Language)) {
		return value as Language;
	}

	if ('string' === typeof value) {
		const base = value.split('-')[0]?.toLowerCase();
		const match = LANGUAGES.find((language) => language.split('-')[0]?.toLowerCase() === base);

		if (undefined !== match) {
			return match;
		}
	}

	return DEFAULT_LANGUAGE;
}
