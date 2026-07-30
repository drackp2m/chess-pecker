import { Injectable } from '@nestjs/common';

import { UserSummary } from '../definition/user-summary.interface';
import { SearchUserRequestDto } from '../dto/request/search-user-request.dto';
import { User } from '../user.entity';
import { UserRepository } from '../user.repository';

const DEFAULT_LIMIT = 10;

/**
 * `%` y `_` son comodines de LIKE: sin escapar, buscar «a%» listaría a todo el mundo en vez
 * de a nadie, que es lo que un username con esos caracteres debería devolver.
 */
const escapeLikePattern = (value: string): string => value.replace(/[\\%_]/gu, '\\$&');

@Injectable()
export class SearchUsersUseCase {
	constructor(private readonly userRepository: UserRepository) {}

	/**
	 * Búsqueda por prefijo, para poder encontrar a alguien antes de pedirle amistad. Es lo
	 * mínimo que hace falta para que la pantalla de amigos distinga un error de tecleo de un
	 * desconocido, y por eso devuelve `UserSummary` y no la entidad.
	 *
	 * Uno mismo no aparece: pedirse amistad a uno mismo lo rechaza el caso de uso de después,
	 * así que no tiene sentido ofrecerlo aquí.
	 */
	async execute(currentUser: User, search: SearchUserRequestDto): Promise<UserSummary[]> {
		const users = await this.userRepository.getMany(
			{
				username: { $ilike: `${escapeLikePattern(search.username)}%` },
				uuid: { $ne: currentUser.uuid },
			},
			{ orderBy: { username: 'asc' }, limit: search.limit ?? DEFAULT_LIMIT },
		);

		return users.map((user) => ({ uuid: user.uuid, username: user.username }));
	}
}
