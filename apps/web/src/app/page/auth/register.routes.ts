import { Routes } from '@angular/router';

export default [
	{
		path: '',
		title: 'Create an account',
		loadComponent: () => import('./register.page').then(({ RegisterPage }) => RegisterPage),
	},
] satisfies Routes;
