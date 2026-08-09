import { Routes } from '@angular/router';

import { I18n } from '@app/i18n';

export default [
	{
		path: '',
		title: I18n.common.SETTINGS,
		loadComponent: () => import('./setting.page').then(({ SettingPage }) => SettingPage),
	},
] satisfies Routes;
