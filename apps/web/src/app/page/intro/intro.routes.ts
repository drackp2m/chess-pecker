import { Routes } from '@angular/router';

import { resolveI18n } from '@app/guard/i18n.resolver';
import { I18n } from '@app/i18n';

export default [
	{
		path: '',
		title: I18n.intro.TITLE,
		resolve: { i18n: resolveI18n('intro') },
		loadComponent: () => import('./intro.page').then(({ IntroPage }) => IntroPage),
	},
] satisfies Routes;
