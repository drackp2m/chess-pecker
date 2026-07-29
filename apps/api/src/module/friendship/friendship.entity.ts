import { Check, Entity, Enum, Index, ManyToOne } from '@mikro-orm/core';

import { CustomBaseEntity } from '../../shared/util/custom-base.entity';
import { User } from '../user/user.entity';

import { FriendshipStatus } from './definition/friendship-status.enum';
import { FriendshipRepository } from './friendship.repository';

/**
 * Una fila por solicitud, no por relación: las rechazadas se quedan como histórico y se
 * puede volver a pedir.
 *
 * Que no existan dos solicitudes vivas entre las mismas dos personas, en cualquiera de los
 * dos sentidos, lo garantiza `friendship_active_pair_unique`: un índice único **parcial**
 * sobre `(least(requester, addressee), greatest(requester, addressee))` limitado a
 * `pending` y `accepted`. No se declara aquí porque MikroORM no sabe leer índices por
 * expresión de la base de datos y volvería a proponerlo en cada migración; vive escrito a
 * mano en `Migration20260729040132`.
 *
 * La tercera condición para poder enviar una solicitud —que no haya un bloqueo— vive en
 * `user_block` y la comprueba el caso de uso.
 */
@Entity({ repository: () => FriendshipRepository })
@Check({ expression: 'requester_uuid <> addressee_uuid' })
@Index({
	name: 'friendship_active_pair_unique',
	expression: `create unique index "friendship_active_pair_unique" on "friendship" (least("requester_uuid", "addressee_uuid"), greatest("requester_uuid", "addressee_uuid")) where "status" in ('pending', 'accepted')`,
})
export class Friendship extends CustomBaseEntity<Friendship> {
	@Index()
	@ManyToOne(() => User, { deleteRule: 'cascade' })
	requester!: User;

	@Index()
	@ManyToOne(() => User, { deleteRule: 'cascade' })
	addressee!: User;

	@Enum({ items: () => FriendshipStatus, default: FriendshipStatus.Pending })
	status!: FriendshipStatus;
}
