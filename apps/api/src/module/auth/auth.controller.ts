import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';

import { User } from '../user/user.entity';

import { CurrentUser } from './decorator/current-user.decorator';
import { Public } from './decorator/public.decorator';
import { LoginRequestDto } from './dto/request/login-request.dto';
import { RegisterRequestDto } from './dto/request/register-request.dto';
import { LoginUseCase } from './use-case/login.use-case';
import { LogoutUseCase } from './use-case/logout.use-case';
import { RefreshSessionUseCase } from './use-case/refresh-session.use-case';
import { RegisterUseCase } from './use-case/register.use-case';

// Session lifecycle endpoints. `@Public()` goes route by route instead of on the
// controller: the entry points are reachable without an access token (you don't have
// one yet when registering / logging in, or it's expired when refreshing), but `me`
// only answers to a session that already exists.
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
	async register(@Body() registerRequest: RegisterRequestDto): Promise<User> {
		return this.registerUseCase.execute(registerRequest);
	}

	@Public()
	@Post('login')
	@HttpCode(HttpStatus.NO_CONTENT)
	async login(@Body() loginRequest: LoginRequestDto): Promise<void> {
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
	 * Quién es el dueño de las cookies. Es lo que pregunta el front al cargar la página: le
	 * hace falta el usuario de la sesión, no tokens nuevos, y `refresh-session` responde sin
	 * cuerpo. La cookie de acceso vive en `/api`, así que llega aquí; la de refresco no, de
	 * modo que un acceso caducado se responde con un 401 y es el cliente quien decide si
	 * pasar por `refresh-session` y volver a preguntar.
	 */
	@Get('me')
	me(@CurrentUser() user: User): User {
		return user;
	}
}
