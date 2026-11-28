const LEGACY_ROUTE = /^#(\/.*)$/u;

export function rewriteLegacyHashUrl(
	location: Pick<Location, 'hash'>,
	history: Pick<History, 'replaceState'>,
): void {
	const route = LEGACY_ROUTE.exec(location.hash)?.[1];

	if (undefined !== route) {
		history.replaceState(null, '', route);
	}
}
