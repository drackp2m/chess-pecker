import { Routes } from '@angular/router';

export default [
	{
		path: '',
		title: 'Training',
		loadComponent: () => import('./training.page').then(({ TrainingPage }) => TrainingPage),
	},
	{
		path: 'solve',
		title: 'Solving',
		loadComponent: () =>
			import('./training-solve.page').then(({ TrainingSolvePage }) => TrainingSolvePage),
	},
] satisfies Routes;
