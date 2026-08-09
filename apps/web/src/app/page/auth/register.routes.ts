import { Routes } from '@angular/router';

import { I18n } from '@app/i18n';

export default [
	{
		path: '',
		title: I18n.common.CREATE_ACCOUNT,
		loadComponent: () => import('./register.page').then(({ RegisterPage }) => RegisterPage),
	},
] satisfies Routes;
