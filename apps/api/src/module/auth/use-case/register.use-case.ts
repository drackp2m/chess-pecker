import type { RegisterRequest } from '@chesspecker/api-definitions';
import type { EntityData } from '@mikro-orm/core';
import { Inject, Injectable } from '@nestjs/common';

import { PreconditionFailedException } from '../../../shared/exception/precondition-failed.exception';
import { User } from '../../user/user.entity';
import { UserRepository } from '../../user/user.repository';

import { HashPasswordUseCase } from './hash-password.use-case';

@Injectable()
export class RegisterUseCase {
	constructor(
		@Inject(UserRepository)
		private readonly userRepository: UserRepository,
		@Inject(HashPasswordUseCase)
		private readonly hashPasswordUseCase: HashPasswordUseCase,
	) {}

	async execute(registerRequest: RegisterRequest): Promise<User> {
		const userExists = await this.userRepository.getMany({
			$or: [
				{ username: registerRequest.username },
				{
					...(registerRequest.email !== undefined ? { email: registerRequest.email } : {}),
				},
			],
		});

		const existingUser = userExists.at(0);

		if (undefined !== existingUser) {
			const field = existingUser.username === registerRequest.username ? 'username' : 'email';

			throw new PreconditionFailedException('already exists', field);
		}

		registerRequest.password = await this.hashPasswordUseCase.execute(registerRequest.password);

		const userData: EntityData<User> = {
			username: registerRequest.username,
			password: registerRequest.password,
		};

		if (undefined !== registerRequest.email) {
			userData.email = registerRequest.email;
		}

		const user = new User(userData);

		return this.userRepository.insert(user);
	}
}
