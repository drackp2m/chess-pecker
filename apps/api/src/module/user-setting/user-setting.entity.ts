import type { SettingValue } from '@chesspecker/api-definitions';
import { Entity, ManyToOne, Property, Unique } from '@mikro-orm/core';

import { CustomBaseEntity } from '../../shared/util/custom-base.entity';
import { User } from '../user/user.entity';

import { UserSettingRepository } from './user-setting.repository';

/**
 * Preferencias de la aplicación, en clave-valor: los ajustes crecen y cambian de forma
 * (un booleano puede pasar a enum, un escalar a lista), y con una columna por ajuste cada
 * cambio sería una migración.
 *
 * La validación por clave vive en el código, no aquí: la base de datos no sabe qué temas
 * de tablero hay instalados. `key` es varchar y no un enum por el mismo motivo — añadir un
 * ajuste no debe tocar el esquema.
 *
 * Los valores por defecto no se insertan como filas: ausencia de fila = valor por defecto
 * del código, así cambiar un default no obliga a tocar las filas existentes.
 */
@Entity({ repository: () => UserSettingRepository })
@Unique({ properties: ['user', 'key'] })
export class UserSetting extends CustomBaseEntity<UserSetting> {
	@ManyToOne(() => User, { deleteRule: 'cascade' })
	user!: User;

	@Property()
	key!: string;

	@Property({ type: 'json' })
	value!: SettingValue;
}
