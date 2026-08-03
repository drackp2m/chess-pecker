import { DBSchema } from 'idb';

import { SettingTypeKey } from '@app/definition/model/setting/setting-type.enum';
import { Setting } from '@app/model/setting.model';

export interface SettingSchema extends DBSchema {
	setting: {
		key: SettingTypeKey;
		value: Setting;
	};
}

export interface SettingSchemaV1 extends DBSchema {
	setting: {
		key: string;
		value: Setting;
		indexes: { type: SettingTypeKey };
	};
}
