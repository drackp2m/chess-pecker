export type Language = 'es' | 'en';

export const LANGUAGES: readonly Language[] = ['es', 'en'];

export const DEFAULT_LANGUAGE: Language = 'es';

export const LANGUAGE_NAME = {
	es: 'Español',
	en: 'English',
} as const satisfies Record<Language, string>;

export const LANGUAGE_FLAG = {
	es: 'svg/flag/es.svg',
	en: 'svg/flag/gb.svg',
} as const satisfies Record<Language, string>;

export function normalizeLanguage(value: unknown): Language {
	return LANGUAGES.includes(value as Language) ? (value as Language) : DEFAULT_LANGUAGE;
}
