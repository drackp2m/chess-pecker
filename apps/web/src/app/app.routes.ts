import { Routes } from '@angular/router';

import { authenticatedGuard } from '@app/guard/authenticated.guard';
import { introGuard } from '@app/guard/intro.guard';
import { MainLayout } from '@app/layout/main/main.layout';

export const APP_ROUTES: Routes = [
	{
		path: 'intro',
		loadChildren: () => import('./page/intro/intro.routes'),
	},
	{
		path: '',
		component: MainLayout,
		canActivate: [introGuard],
		children: [
			{
				path: '',
				loadChildren: () => import('./page/dashboard/dashboard.routes'),
			},
			{
				path: 'register',
				loadChildren: () => import('./page/auth/register.routes'),
			},
			{
				path: 'login',
				loadChildren: () => import('./page/auth/login.routes'),
			},
			{
				path: 'training',
				canActivate: [authenticatedGuard],
				loadChildren: () => import('./page/training/training.routes'),
			},
			{
				path: 'puzzles',
				loadChildren: () => import('./page/puzzle/puzzle.routes'),
			},
			{
				path: 'profile',
				canActivate: [authenticatedGuard],
				loadChildren: () => import('./page/profile/profile.routes'),
			},
			{
				path: 'match',
				loadChildren: () => import('./page/match/match.routes'),
			},
			{
				path: 'settings',
				loadChildren: () => import('./page/setting/setting.routes'),
			},
		],
	},
];
