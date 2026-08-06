import { Routes } from '@angular/router';

export default [
	{
		path: '',
		title: 'Profile',
		loadComponent: () => import('./profile.page').then(({ ProfilePage }) => ProfilePage),
	},
] satisfies Routes;
