import { CustomRepository } from '../../shared/util/custom-entity.repository';

import { UserSetting } from './user-setting.entity';

export class UserSettingRepository extends CustomRepository<UserSetting> {
	/**
	 * `insert … on conflict (user_uuid, key) do update`: guardar un ajuste es idempotente y
	 * no necesita leer antes, así que dos pestañas guardando a la vez no se pisan.
	 */
	async upsertByKey(setting: UserSetting): Promise<UserSetting> {
		// Los datos van explícitos y no como instancia: de una entidad que el EntityManager
		// nunca ha visto, `upsert` no saca ningún campo y manda un insert vacío.
		return this.entityManager.fork().upsert(
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
	}
}
