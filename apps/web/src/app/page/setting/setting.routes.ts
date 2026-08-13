import { Routes } from '@angular/router';

import { resolveI18n } from '@app/guard/i18n.resolver';
import { I18n } from '@app/i18n';

export default [
	{
		path: '',
		title: I18n.common.SETTINGS,
		resolve: { i18n: resolveI18n('setting') },
		loadComponent: () => import('./setting.page').then(({ SettingPage }) => SettingPage),
	},
] satisfies Routes;
