import { Routes } from '@angular/router';

import { resolveI18n } from '@app/guard/i18n.resolver';
import { I18n } from '@app/i18n';

export default [
	{
		path: '',
		title: I18n.common.EXERCISES,
		resolve: { i18n: resolveI18n('puzzle') },
		loadComponent: () => import('./puzzle.page').then(({ PuzzlePage }) => PuzzlePage),
	},
	{
		// Same page, opened straight onto the bundled example so the exercise
		// trainer can be tried without pasting a CSV first.
		path: 'sample',
		title: I18n.common.SAMPLE_EXERCISE,
		data: { sample: true },
		resolve: { i18n: resolveI18n('puzzle') },
		loadComponent: () => import('./puzzle.page').then(({ PuzzlePage }) => PuzzlePage),
	},
] satisfies Routes;
