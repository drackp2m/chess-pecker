import { Routes } from '@angular/router';

import { MainLayout } from '@app/layout/main/main.layout';

export const APP_ROUTES: Routes = [
	{
		path: '',
		component: MainLayout,
		children: [
			{
				path: '',
				loadChildren: () => import('./page/dashboard/dashboard.routes'),
			},
			{
				path: 'match',
				loadChildren: () => import('./page/match/match.routes'),
			},
			{
				path: 'puzzles',
				loadChildren: () => import('./page/puzzle/puzzle.routes'),
			},
			{
				path: 'settings',
				loadChildren: () => import('./page/setting/setting.routes'),
			},
			{
				path: 'login',
				loadChildren: () => import('./page/auth/login.routes'),
			},
			{
				path: 'register',
				loadChildren: () => import('./page/auth/register.routes'),
			},
		],
	},
];
