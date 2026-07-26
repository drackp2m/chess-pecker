import { DBSchema } from 'idb';

import { Setting } from '@app/model/setting.model';

export interface SettingSchema extends DBSchema {
	setting: {
		key: string;
		value: Setting;
		indexes: { type: string };
	};
}
