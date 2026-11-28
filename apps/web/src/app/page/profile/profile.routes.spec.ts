import { Route } from '@angular/router';
import { describe, expect, it } from 'vitest';

import type { RouteBack } from '@app/definition/route-back.type';
import PROFILE_ROUTES from '@app/page/profile/profile.routes';

function backOf(path: string, params: Readonly<Record<string, string>> = {}): string | undefined {
	const route: Route | undefined = PROFILE_ROUTES.find((candidate) => path === candidate.path);
	const back = route?.data?.['back'] as RouteBack | undefined;

	return 'function' === typeof back ? back(params) : back;
}

describe('PROFILE_ROUTES back links', () => {
	it('sends an exercise of a bookmark list back to that list', () => {
		expect(backOf('bookmarks/:type/solve/:id', { type: 'tactic', id: '42' })).toBe(
			'/profile/bookmarks/tactic',
		);
		expect(backOf('bookmarks/:type/solve', { type: 'tactic' })).toBe('/profile/bookmarks/tactic');
	});

	it('sends a bookmark list and a challenge list back to the profile', () => {
		expect(backOf('bookmarks/:type')).toBe('/profile');
		expect(backOf('challenges/:direction')).toBe('/profile');
	});

	it('sends the results of a challenge back to its direction', () => {
		expect(backOf('challenges/:direction/:uuid', { direction: 'sent', uuid: 'abc' })).toBe(
			'/profile/challenges/sent',
		);
	});

	it('sends a challenge being solved back to the received ones, which exists', () => {
		expect(backOf('challenges/received/solve/:uuid', { uuid: 'abc' })).toBe(
			'/profile/challenges/received',
		);
	});

	it('sends the avatar, the account and the friends back to the profile', () => {
		expect(backOf('avatar')).toBe('/profile');
		expect(backOf('account')).toBe('/profile');
		expect(backOf('friends')).toBe('/profile');
	});

	it('asks for a session on every page that needs one, and not on the profile or bookmarks', () => {
		const guarded = PROFILE_ROUTES.filter((route) => undefined !== route.canActivate).map(
			(route) => route.path,
		);

		expect(guarded).toStrictEqual([
			'challenges/received/solve/:uuid',
			'challenges/:direction/:uuid',
			'challenges/:direction',
			'avatar',
			'account',
			'friends',
		]);
	});

	it('leaves the profile itself, a root of the menu, without a back link', () => {
		expect(backOf('')).toBeUndefined();
	});
});
