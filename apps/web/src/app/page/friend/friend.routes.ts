import { Routes } from '@angular/router';

export default [
	{
		path: '',
		title: 'Friends',
		loadComponent: () => import('./friend.page').then(({ FriendPage }) => FriendPage),
	},
] satisfies Routes;
