import { Routes } from '@angular/router';

import { I18n } from '@app/i18n';

export default [
	{
		path: '',
		title: I18n.common.MATCH,
		loadComponent: () => import('./match.page').then(({ MatchPage }) => MatchPage),
	},
] satisfies Routes;
