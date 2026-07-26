import { Routes } from '@angular/router';

export default [
	{
		path: '',
		title: 'Settings',
		loadComponent: () => import('./setting.page').then(({ SettingPage }) => SettingPage),
	},
] satisfies Routes;
