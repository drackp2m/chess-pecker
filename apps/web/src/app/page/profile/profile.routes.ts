import { Routes } from '@angular/router';

import { resolveI18n } from '@app/guard/i18n.resolver';
import { I18n } from '@app/i18n';

export default [
	{
		path: '',
		title: I18n.common.PROFILE,
		resolve: { i18n: resolveI18n('profile') },
		loadComponent: () => import('./profile.page').then(({ ProfilePage }) => ProfilePage),
	},
] satisfies Routes;
