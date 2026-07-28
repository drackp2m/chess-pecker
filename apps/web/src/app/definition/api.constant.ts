function withCurrentHostname(url: string): string {
	const parsed = new URL(url);

	parsed.hostname = globalThis.location.hostname;

	return `${parsed.origin}${parsed.pathname.replace(/\/$/u, '')}`;
}

function resolveApiUrl(): string {
	if ('undefined' === typeof API_URL) {
		return '/api';
	}

	return 'undefined' !== typeof APP_DEBUG && APP_DEBUG ? withCurrentHostname(API_URL) : API_URL;
}

export const API_BASE_URL = resolveApiUrl();
