import { Routes } from '@angular/router';

import { I18n } from '@app/i18n';

export default [
	{
		path: '',
		title: I18n.common.LOG_IN,
		loadComponent: () => import('./login.page').then(({ LoginPage }) => LoginPage),
	},
] satisfies Routes;
