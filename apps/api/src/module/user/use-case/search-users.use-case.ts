import type { SearchUserRequest, UserSummary } from '@chesspecker/api-definitions';
import { Injectable } from '@nestjs/common';

import { User } from '../user.entity';
import { UserRepository } from '../user.repository';

const DEFAULT_LIMIT = 10;

/**
 * `%` and `_` are LIKE wildcards: unescaped, searching "a%" would list everybody instead of
 * nobody, which is what a username holding those characters should return.
 */
const escapeLikePattern = (value: string): string => value.replace(/[\\%_]/gu, '\\$&');

@Injectable()
export class SearchUsersUseCase {
	constructor(private readonly userRepository: UserRepository) {}

	/**
	 * Prefix search, so someone can be found before being asked. Returns `UserSummary` and
	 * never the caller themselves, whom the next use case would refuse anyway.
	 */
	async execute(currentUser: User, search: SearchUserRequest): Promise<UserSummary[]> {
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
