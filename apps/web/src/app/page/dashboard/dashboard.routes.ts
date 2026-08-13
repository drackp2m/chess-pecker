import { Routes } from '@angular/router';

import { resolveI18n } from '@app/guard/i18n.resolver';

export default [
	{
		path: '',
		title: '',
		resolve: { i18n: resolveI18n('dashboard') },
		loadComponent: () => import('./dashboard.page').then(({ DashboardPage }) => DashboardPage),
	},
] satisfies Routes;
