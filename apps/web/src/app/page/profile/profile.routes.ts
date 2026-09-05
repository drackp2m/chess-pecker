import { Routes } from '@angular/router';

import { resolveI18n } from '@app/guard/i18n.resolver';
import { I18n } from '@app/i18n';

export default [
	{
		path: 'bookmarks/:type/solve/:id',
		title: I18n.common.EXERCISES,
		resolve: { i18n: resolveI18n('puzzle') },
		loadComponent: () =>
			import('./bookmark-list.page').then(({ BookmarkListPage }) => BookmarkListPage),
	},
	{
		path: 'bookmarks/:type/solve',
		title: I18n.common.EXERCISES,
		resolve: { i18n: resolveI18n('puzzle') },
		loadComponent: () =>
			import('./bookmark-list.page').then(({ BookmarkListPage }) => BookmarkListPage),
	},
	{
		path: 'bookmarks/:type',
		title: I18n.common.BOOKMARK_TITLE,
		resolve: { i18n: resolveI18n('puzzle') },
		loadComponent: () =>
			import('./bookmark-category.page').then(({ BookmarkCategoryPage }) => BookmarkCategoryPage),
	},
	{
		path: '',
		title: I18n.common.PROFILE,
		resolve: { i18n: resolveI18n('profile') },
		loadComponent: () => import('./profile.page').then(({ ProfilePage }) => ProfilePage),
	},
] satisfies Routes;
