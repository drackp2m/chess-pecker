import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'vitest-mock-extended';

import { User } from '../user/user.entity';

import { AuthController } from './auth.controller';
import { LoginRequestDto } from './dto/request/login-request.dto';
import { RegisterRequestDto } from './dto/request/register-request.dto';
import { LoginUseCase } from './use-case/login.use-case';
import { LogoutUseCase } from './use-case/logout.use-case';
import { RefreshSessionUseCase } from './use-case/refresh-session.use-case';
import { RegisterUseCase } from './use-case/register.use-case';

describe('AuthController', () => {
	let authController: AuthController;
	const registerUseCase = mock<RegisterUseCase>();
	const loginUseCase = mock<LoginUseCase>();
	const logoutUseCase = mock<LogoutUseCase>();
	const refreshSessionUseCase = mock<RefreshSessionUseCase>();

	beforeAll(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [AuthController],
			providers: [
				{ provide: RegisterUseCase, useValue: registerUseCase },
				{ provide: LoginUseCase, useValue: loginUseCase },
				{ provide: LogoutUseCase, useValue: logoutUseCase },
				{ provide: RefreshSessionUseCase, useValue: refreshSessionUseCase },
			],
		}).compile();

		authController = await module.resolve(AuthController);
	});

	it('should be defined', () => {
		expect(authController).toBeDefined();
	});

	describe('register', () => {
		it('should return User instance', async () => {
			registerUseCase.execute.mockResolvedValueOnce(new User());

			const requestDto: RegisterRequestDto = {
				username: 'drackp2m',
				password: 'password',
			};

			const result = await authController.register(requestDto);

			expect(result).toBeInstanceOf(User);
		});
	});

	describe('login', () => {
		it('should return undefined', async () => {
			const requestDto: LoginRequestDto = {
				username: 'drackp2m',
				password: 'password',
			};

			await expect(authController.login(requestDto)).resolves.toBeUndefined();
		});
	});

	describe('logout', () => {
		it('should delegate to the logout use case', () => {
			authController.logout();

			expect(logoutUseCase.execute).toHaveBeenCalledTimes(1);
		});
	});

	describe('refreshSession', () => {
		it('should delegate to the refresh session use case', () => {
			authController.refreshSession();

			expect(refreshSessionUseCase.execute).toHaveBeenCalledTimes(1);
		});
	});
});
