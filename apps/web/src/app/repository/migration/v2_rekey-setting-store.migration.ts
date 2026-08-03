import { SettingTypeKey } from '@app/definition/model/setting/setting-type.enum';
import { Setting } from '@app/model/setting.model';
import { AppSchema } from '@app/repository/definition/app-schema.interface';
import { Migration } from '@app/repository/definition/migration.interface';

function latestByType(settings: Setting[]): Setting[] {
	const latest = new Map<SettingTypeKey, Setting>();

	for (const setting of settings) {
		const current = latest.get(setting.type);

		if (undefined === current || current.updatedAt.getTime() <= setting.updatedAt.getTime()) {
			latest.set(setting.type, setting);
		}
	}

	return [...latest.values()];
}

export const rekeySettingStoreMigration: Migration<AppSchema> = {
	version: 2,
	description: 'rekey setting store by type',
	apply: async ({ database, transaction }) => {
		const stored = await transaction.objectStore('setting').getAll();

		database.deleteObjectStore('setting');

		const store = database.createObjectStore('setting', { keyPath: 'type' });

		await Promise.all(latestByType(stored).map((setting) => store.put(setting)));
	},
};
