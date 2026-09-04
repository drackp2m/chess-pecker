import type { LoginRequest } from '@chesspecker/api-definitions';
import { Inject, Injectable, Scope } from '@nestjs/common';

import { UnauthorizedException } from '../../../shared/exception/unauthorized-exception.exception';
import { UserRepository } from '../../user/user.repository';
import { JwtCookie } from '../definition/jwt-cookie.enum';

import { CheckPasswordUseCase } from './check-password.use-case';
import { CreateJwtAccessTokenUseCase } from './create-jwt-access-token.use-case';
import { CreateJwtRefreshTokenUseCase } from './create-jwt-refresh-token.use-case';
import { SetJwtTokenUseCase } from './set-jwt-token.use-case';

@Injectable({ scope: Scope.REQUEST })
export class LoginUseCase {
	constructor(
		@Inject(UserRepository)
		private readonly userRepository: UserRepository,
		@Inject(CheckPasswordUseCase)
		private readonly checkPassword: CheckPasswordUseCase,
		@Inject(CreateJwtAccessTokenUseCase)
		private readonly createAccessToken: CreateJwtAccessTokenUseCase,
		@Inject(CreateJwtRefreshTokenUseCase)
		private readonly createRefreshToken: CreateJwtRefreshTokenUseCase,
		private readonly setJwtToken: SetJwtTokenUseCase,
	) {}

	async execute(loginRequest: LoginRequest): Promise<void> {
		const user = await this.userRepository.getOne({ username: loginRequest.username });

		if (!(await this.checkPassword.execute(loginRequest.password, user.password))) {
			throw new UnauthorizedException('not match', 'password');
		}

		const accessToken = this.createAccessToken.execute(user.uuid);
		const refreshToken = this.createRefreshToken.execute(user.uuid);

		this.setJwtToken.execute(JwtCookie.access, accessToken);
		this.setJwtToken.execute(JwtCookie.refresh, refreshToken);
	}
}
