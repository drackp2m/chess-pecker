import { Routes } from '@angular/router';

export default [
	{
		path: '',
		title: '',
		loadComponent: () => import('./dashboard.page').then(({ DashboardPage }) => DashboardPage),
	},
] satisfies Routes;
