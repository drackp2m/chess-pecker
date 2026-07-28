import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';

import { User } from '../user/user.entity';

import { Public } from './decorator/public.decorator';
import { LoginRequestDto } from './dto/request/login-request.dto';
import { RegisterRequestDto } from './dto/request/register-request.dto';
import { LoginUseCase } from './use-case/login.use-case';
import { LogoutUseCase } from './use-case/logout.use-case';
import { RefreshSessionUseCase } from './use-case/refresh-session.use-case';
import { RegisterUseCase } from './use-case/register.use-case';

// Session lifecycle endpoints: reachable without an access token (you don't
// have one yet when registering / logging in, or it's expired when refreshing).
@Public()
@Controller('auth')
export class AuthController {
	constructor(
		private readonly registerUseCase: RegisterUseCase,
		private readonly loginUseCase: LoginUseCase,
		private readonly logoutUseCase: LogoutUseCase,
		private readonly refreshSessionUseCase: RefreshSessionUseCase,
	) {}

	@Post('register')
	async register(@Body() registerRequest: RegisterRequestDto): Promise<User> {
		return this.registerUseCase.execute(registerRequest);
	}

	@Post('login')
	@HttpCode(HttpStatus.NO_CONTENT)
	async login(@Body() loginRequest: LoginRequestDto): Promise<void> {
		return this.loginUseCase.execute(loginRequest);
	}

	@Get('logout')
	@HttpCode(HttpStatus.NO_CONTENT)
	logout(): void {
		this.logoutUseCase.execute();
	}

	@Get('refresh-session')
	@HttpCode(HttpStatus.NO_CONTENT)
	refreshSession(): void {
		this.refreshSessionUseCase.execute();
	}
}
