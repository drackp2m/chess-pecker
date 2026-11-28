import { Route } from '@angular/router';
import { describe, expect, it } from 'vitest';

import SETTING_ROUTES from '@app/page/setting/setting.routes';

function backOf(path: string): unknown {
	const route: Route | undefined = SETTING_ROUTES.find((candidate) => path === candidate.path);

	return route?.data?.['back'];
}

describe('SETTING_ROUTES back links', () => {
	it('sends the board settings back to the settings', () => {
		expect(backOf('board')).toBe('/settings');
	});

	it('leaves the settings themselves, a root of the menu, without a back link', () => {
		expect(backOf('')).toBeUndefined();
	});
});
