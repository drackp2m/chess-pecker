/**
 * ToDo => Try to add this languages
 * + en-GB => English
 * + ru-RU => Русский
 * + hi-IN => हिन्दी
 * + es-ES => Español
 * + fr-FR => Français
 * - de-DE => Deutsch
 * - pt-BR => Português
 * - tr-TR => Türkçe
 * - id-ID => Bahasa Indonesia
 * - pl-PL => Polski
 * - uk-UA => Українська
 * - it-IT => Italiano
 * - vi-VN => Tiếng Việt
 * - nl-NL => Nederlands
 * - zh-CN => 中文
 * + ca-ES => Català
 */

export type Language = 'en-GB' | 'ru-RU' | 'hi-IN' | 'es-ES' | 'fr-FR' | 'ca-ES';

export const LANGUAGES: readonly Language[] = [
	'en-GB',
	'ru-RU',
	'hi-IN',
	'es-ES',
	'fr-FR',
	'ca-ES',
];

export const DEFAULT_LANGUAGE: Language = 'es-ES';

export const LANGUAGE_NAME = {
	'en-GB': 'English',
	'ru-RU': 'Русский',
	'hi-IN': 'हिन्दी',
	'es-ES': 'Español',
	'fr-FR': 'Français',
	'ca-ES': 'Català',
} as const satisfies Record<Language, string>;

export const LANGUAGE_FLAG = {
	'en-GB': 'svg/flag/gb.svg',
	'ru-RU': 'svg/flag/ru.svg',
	'hi-IN': 'svg/flag/in.svg',
	'es-ES': 'svg/flag/es.svg',
	'fr-FR': 'svg/flag/fr.svg',
	'ca-ES': 'svg/flag/es-ct.svg',
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
