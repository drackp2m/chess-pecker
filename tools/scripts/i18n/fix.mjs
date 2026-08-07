import { readFileSync, writeFileSync } from 'node:fs';

import { isUlid } from './config.mjs';

function nextContent(scope, translation, prune) {
	const data = translation.data ?? {};
	const result = {};

	for (const { ulid } of scope.keys.entries.filter((entry) => isUlid(entry.ulid))) {
		result[ulid] = data[ulid] ?? '';
	}

	if (!prune) {
		for (const [ulid, value] of Object.entries(data)) {
			if (!(ulid in result)) {
				result[ulid] = value;
			}
		}
	}

	return `${JSON.stringify(result, null, '\t')}\n`;
}

export function applyFix({ scopes, langs, prune }) {
	const written = [];

	for (const scope of scopes.filter((entry) => entry.keys)) {
		for (const lang of langs) {
			const translation = scope.translations.get(lang);

			if (translation.error) {
				continue;
			}

			const content = nextContent(scope, translation, prune);
			const current = translation.exists ? readFileSync(translation.file, 'utf8') : null;

			if (content !== current) {
				writeFileSync(translation.file, content, 'utf8');
				written.push(translation.file);
			}
		}
	}

	return written;
}
