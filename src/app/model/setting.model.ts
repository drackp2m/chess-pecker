import { ModelConstructorOmit } from '@app/definition/model/model-constructor-omit.type';
import { SettingTypeKey } from '@app/definition/model/setting/setting-type.enum';
import { SettingPayload } from '@app/definition/model/setting/setting-type.type';
import { UpdatableModel } from '@app/model/updatable.model';

export class Setting<T extends SettingTypeKey = SettingTypeKey> extends UpdatableModel<Setting<T>> {
	type!: T;
	payload!: SettingPayload[T];

	constructor(model: ModelConstructorOmit<Setting>) {
		super();

		Object.assign(this, model);
	}
}
