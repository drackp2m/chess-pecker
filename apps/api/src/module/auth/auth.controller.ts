import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { loginRequestSchema, registerRequestSchema } from '@chesspecker/api-definitions';
import type { LoginRequest, RegisterRequest } from '@chesspecker/api-definitions';

import { User } from '../user/user.entity';

import { CurrentUser } from './decorator/current-user.decorator';
import { Public } from './decorator/public.decorator';
import { LoginUseCase } from './use-case/login.use-case';
import { LogoutUseCase } from './use-case/logout.use-case';
import { RefreshSessionUseCase } from './use-case/refresh-session.use-case';
import { RegisterUseCase } from './use-case/register.use-case';

// Session lifecycle endpoints. `@Public()` goes route by route: the entry points need no
// access token, but `me` only answers to a session that already exists.
@Controller('auth')
export class AuthController {
	constructor(
		private readonly registerUseCase: RegisterUseCase,
		private readonly loginUseCase: LoginUseCase,
		private readonly logoutUseCase: LogoutUseCase,
		private readonly refreshSessionUseCase: RefreshSessionUseCase,
	) {}

	@Public()
	@Post('register')
	async register(
		@Body({ schema: registerRequestSchema }) registerRequest: RegisterRequest,
	): Promise<User> {
		return this.registerUseCase.execute(registerRequest);
	}

	@Public()
	@Post('login')
	@HttpCode(HttpStatus.NO_CONTENT)
	async login(@Body({ schema: loginRequestSchema }) loginRequest: LoginRequest): Promise<void> {
		return this.loginUseCase.execute(loginRequest);
	}

	@Public()
	@Get('logout')
	@HttpCode(HttpStatus.NO_CONTENT)
	logout(): void {
		this.logoutUseCase.execute();
	}

	@Public()
	@Get('refresh-session')
	@HttpCode(HttpStatus.NO_CONTENT)
	refreshSession(): void {
		this.refreshSessionUseCase.execute();
	}

	/**
	 * Who owns the cookies, which is what the front asks on load. Only the access cookie
	 * reaches here, so an expired one gets a 401 and the client decides whether to refresh.
	 */
	@Get('me')
	me(@CurrentUser() user: User): User {
		return user;
	}
}
