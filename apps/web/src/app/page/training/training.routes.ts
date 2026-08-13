import { Routes } from '@angular/router';

import { BOARD_PRESENTER } from '@app/definition/board-presenter.interface';
import { resolveI18n } from '@app/guard/i18n.resolver';
import { I18n, provideI18nScope } from '@app/i18n';
import { PuzzleStore } from '@app/page/puzzle/store/puzzle/puzzle.store';
import { PuzzleLibraryStore } from '@app/page/puzzle/store/puzzle-library/puzzle-library.store';
import { TrainingRunStore } from '@app/page/training/store/training-run.store';
import { TrainingSolveSession } from '@app/page/training/store/training-solve-session';

export default [
	{
		path: '',
		// Provided by the section, not by the page on purpose: the route's injector lives
		// as long as the route stays activated, so going back to the training page and
		// returning keeps the exercise, its board and its clock. Pushing any of these down
		// into `TrainingSolvePage` drops the attempt again.
		providers: [
			provideI18nScope('training'),
			PuzzleLibraryStore,
			PuzzleStore,
			TrainingRunStore,
			TrainingSolveSession,
			{ provide: BOARD_PRESENTER, useExisting: PuzzleStore },
		],
		resolve: { i18n: resolveI18n('training') },
		children: [
			{
				path: '',
				title: I18n.common.TRAINING,
				loadComponent: () => import('./training.page').then(({ TrainingPage }) => TrainingPage),
			},
			{
				path: 'solve',
				title: I18n.common.SOLVING,
				loadComponent: () =>
					import('./training-solve.page').then(({ TrainingSolvePage }) => TrainingSolvePage),
			},
		],
	},
] satisfies Routes;
