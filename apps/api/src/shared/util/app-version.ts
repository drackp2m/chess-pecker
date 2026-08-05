import { readFileSync } from 'node:fs';

const ROOT_PACKAGE_PATH = '../../package.json';

const UNKNOWN_VERSION = 'unknown';

let cached: string | undefined;

export function appVersion(): string {
	cached ??= readVersion();

	return cached;
}

function readVersion(): string {
	try {
		const parsed: unknown = JSON.parse(readFileSync(ROOT_PACKAGE_PATH, 'utf8'));

		if (null === parsed || 'object' !== typeof parsed) {
			return UNKNOWN_VERSION;
		}

		const { version } = parsed as { version?: unknown };

		return 'string' === typeof version ? version : UNKNOWN_VERSION;
	} catch {
		return UNKNOWN_VERSION;
	}
}
