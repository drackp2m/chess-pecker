import { Routes } from '@angular/router';

import { resolveI18n } from '@app/guard/i18n.resolver';
import { I18n } from '@app/i18n';

export default [
	{
		path: '',
		title: I18n.common.LOG_IN,
		resolve: { i18n: resolveI18n('auth') },
		loadComponent: () => import('./login.page').then(({ LoginPage }) => LoginPage),
	},
] satisfies Routes;
