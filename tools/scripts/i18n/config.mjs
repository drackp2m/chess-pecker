import path from 'node:path';

export const DEFAULTS = {
	i18nDir: path.join('apps', 'web', 'src', 'app', 'i18n'),
	sourceDirs: [path.join('apps', 'web', 'src')],
	langs: ['es-ES', 'ca-ES', 'en-GB'],
	defaultLang: 'es-ES',
	rootScope: 'common',
};

const ULID_PATTERN = /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/;

export const isUlid = (value) => ULID_PATTERN.test(value);

export const toPascalCase = (name) =>
	name.replace(/(^|-)([a-z0-9])/g, (_match, _separator, char) => char.toUpperCase());

export const toKebabCase = (name) => name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

export function parseArgs(argv) {
	const value = (flag) => {
		const index = argv.indexOf(flag);

		return -1 === index ? null : argv[index + 1];
	};

	const langs = value('--langs')?.split(',').filter(Boolean);

	return {
		...DEFAULTS,
		...(value('--dir') ? { i18nDir: value('--dir') } : {}),
		...(value('--source') ? { sourceDirs: value('--source').split(',').filter(Boolean) } : {}),
		...(langs?.length ? { langs, defaultLang: langs[0] } : {}),
		fix: argv.includes('--fix'),
	};
}
