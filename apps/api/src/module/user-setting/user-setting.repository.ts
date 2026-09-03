import { CustomRepository } from '../../shared/util/custom-entity.repository';

import { UserSetting } from './user-setting.entity';

export class UserSettingRepository extends CustomRepository<UserSetting> {
	/**
	 * `insert … on conflict do update`: saving a setting is idempotent and reads nothing
	 * first, so two tabs saving at once do not overwrite each other.
	 */
	async upsertByKey(setting: UserSetting): Promise<UserSetting> {
		// The data goes in explicitly and not as an instance: from an entity the EntityManager
		// has never seen, `upsert` reads no fields and sends an empty insert.
		const entityManager = this.entityManager.fork();

		await entityManager.upsert(
			UserSetting,
			{
				uuid: setting.uuid,
				createdAt: setting.createdAt,
				updatedAt: setting.updatedAt,
				user: setting.user,
				key: setting.key,
				value: setting.value,
			},
			{
				onConflictFields: ['user', 'key'],
				onConflictMergeFields: ['value', 'updatedAt'],
			},
		);

		return entityManager.findOneOrFail(UserSetting, {
			user: setting.user,
			key: setting.key,
		});
	}
}
