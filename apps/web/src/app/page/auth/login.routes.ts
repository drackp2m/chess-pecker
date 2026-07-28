import { Routes } from '@angular/router';

export default [
	{
		path: '',
		title: 'Log in',
		loadComponent: () => import('./login.page').then(({ LoginPage }) => LoginPage),
	},
] satisfies Routes;
