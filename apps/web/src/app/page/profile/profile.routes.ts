import { Routes } from '@angular/router';

import type { RouteBack } from '@app/definition/route-back.type';
import { resolveI18n } from '@app/guard/i18n.resolver';
import { I18n } from '@app/i18n';

export default [
	{
		path: 'bookmarks/:type/solve/:id',
		title: I18n.common.EXERCISES,
		data: { back: (({ type = '' }) => `/profile/bookmarks/${type}`) satisfies RouteBack },
		resolve: { i18n: resolveI18n('puzzle') },
		loadComponent: () =>
			import('./bookmark-list.page').then(({ BookmarkListPage }) => BookmarkListPage),
	},
	{
		path: 'bookmarks/:type/solve',
		title: I18n.common.EXERCISES,
		data: { back: (({ type = '' }) => `/profile/bookmarks/${type}`) satisfies RouteBack },
		resolve: { i18n: resolveI18n('puzzle') },
		loadComponent: () =>
			import('./bookmark-list.page').then(({ BookmarkListPage }) => BookmarkListPage),
	},
	{
		path: 'bookmarks/:type',
		title: I18n.common.BOOKMARK_TITLE,
		data: { back: '/profile' },
		resolve: { i18n: resolveI18n('puzzle') },
		loadComponent: () =>
			import('./bookmark-category.page').then(({ BookmarkCategoryPage }) => BookmarkCategoryPage),
	},
	{
		path: 'challenges/received/solve/:uuid',
		title: I18n.common.CHALLENGE_TITLE,
		data: { back: '/profile/challenges/received' },
		resolve: { i18n: resolveI18n('puzzle') },
		loadComponent: () =>
			import('./challenge-solve.page').then(({ ChallengeSolvePage }) => ChallengeSolvePage),
	},
	{
		path: 'challenges/:direction/:uuid',
		title: I18n.common.CHALLENGE_RESULTS,
		data: {
			back: (({ direction = '' }) => `/profile/challenges/${direction}`) satisfies RouteBack,
		},
		resolve: { i18n: resolveI18n('puzzle') },
		loadComponent: () =>
			import('./challenge-result.page').then(({ ChallengeResultPage }) => ChallengeResultPage),
	},
	{
		path: 'challenges/:direction',
		title: I18n.common.CHALLENGE_TITLE,
		data: { back: '/profile' },
		resolve: { i18n: resolveI18n('puzzle') },
		loadComponent: () =>
			import('./challenge-category.page').then(
				({ ChallengeCategoryPage }) => ChallengeCategoryPage,
			),
	},
	{
		path: '',
		title: I18n.common.PROFILE,
		resolve: { i18n: resolveI18n('profile') },
		loadComponent: () => import('./profile.page').then(({ ProfilePage }) => ProfilePage),
	},
] satisfies Routes;
