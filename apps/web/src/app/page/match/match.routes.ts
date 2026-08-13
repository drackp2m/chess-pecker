import { Routes } from '@angular/router';

import { resolveI18n } from '@app/guard/i18n.resolver';
import { I18n } from '@app/i18n';

export default [
	{
		path: '',
		title: I18n.common.MATCH,
		resolve: { i18n: resolveI18n('match') },
		loadComponent: () => import('./match.page').then(({ MatchPage }) => MatchPage),
	},
] satisfies Routes;
