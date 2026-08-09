import { Routes } from '@angular/router';

import { I18n } from '@app/i18n';

export default [
	{
		path: '',
		title: I18n.common.PROFILE,
		loadComponent: () => import('./profile.page').then(({ ProfilePage }) => ProfilePage),
	},
] satisfies Routes;
