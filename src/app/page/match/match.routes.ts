import { Routes } from '@angular/router';

export default [
	{
		path: '',
		title: 'Match',
		loadComponent: () => import('./match.page').then(({ MatchPage }) => MatchPage),
	},
] satisfies Routes;
