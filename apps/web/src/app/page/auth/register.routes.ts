import { Routes } from '@angular/router';

import { resolveI18n } from '@app/guard/i18n.resolver';
import { I18n } from '@app/i18n';

export default [
	{
		path: '',
		title: I18n.common.CREATE_ACCOUNT,
		resolve: { i18n: resolveI18n('auth') },
		loadComponent: () => import('./register.page').then(({ RegisterPage }) => RegisterPage),
	},
] satisfies Routes;
