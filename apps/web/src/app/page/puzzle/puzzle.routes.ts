import { Routes } from '@angular/router';

export default [
	{
		path: '',
		title: 'Exercises',
		loadComponent: () => import('./puzzle.page').then(({ PuzzlePage }) => PuzzlePage),
	},
	{
		// Same page, opened straight onto the bundled example so the exercise
		// trainer can be tried without pasting a CSV first.
		path: 'sample',
		title: 'Sample exercise',
		data: { sample: true },
		loadComponent: () => import('./puzzle.page').then(({ PuzzlePage }) => PuzzlePage),
	},
] satisfies Routes;
