import type { ExecutionContext } from '@nestjs/common';
import type { HttpArgumentsHost } from '@nestjs/common/internal';
import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'vitest-mock-extended';

import { ForbiddenException } from '../../../shared/exception/forbidden.exception';
import { UnauthorizedException } from '../../../shared/exception/unauthorized-exception.exception';
import { UserRole } from '../../user/definition/user-role.enum';
import { UserFaker } from '../../user/factory/user.faker';

import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
	let guard: RolesGuard;

	const executionContext = mock<ExecutionContext>();
	const httpArgumentsHost = mock<HttpArgumentsHost>();

	const handler = () => [];
	const userFaker = UserFaker;

	beforeAll(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [RolesGuard],
		}).compile();

		guard = await module.resolve(RolesGuard);

		executionContext.switchToHttp.mockReturnValue(httpArgumentsHost);
	});

	it('should be defined', () => {
		expect(guard).toBeDefined();
	});

	describe('canActivate', () => {
		it('throw UnauthorizedException when context is empty', () => {
			executionContext.getHandler.mockReturnValue(handler);
			httpArgumentsHost.getRequest.mockReturnValue({ user: undefined });

			const result = () => guard.canActivate(executionContext);

			expect(result).toThrow(UnauthorizedException);
			expect(result).toThrow(
				expect.objectContaining({
					response: { authorization: 'x-jwt-access-token invalid' },
				}),
			);
		});

		it('throw UnauthorizedException when context has UserRole but args does not have User', () => {
			Reflect.defineMetadata('roles', [UserRole.Registered], handler);

			executionContext.getHandler.mockReturnValue(handler);
			httpArgumentsHost.getRequest.mockReturnValue({ user: undefined });

			const result = () => guard.canActivate(executionContext);

			expect(result).toThrow(UnauthorizedException);
			expect(result).toThrow(
				expect.objectContaining({
					response: { authorization: 'x-jwt-access-token invalid' },
				}),
			);
		});

		it('throw ForbiddenException when context has UserRole but args User has no privileges', () => {
			Reflect.defineMetadata('roles', [UserRole.Registered], handler);

			executionContext.getHandler.mockReturnValue(handler);
			httpArgumentsHost.getRequest.mockReturnValue({
				user: userFaker.makeOne({ role: UserRole.Guest }),
			});

			const result = () => guard.canActivate(executionContext);

			expect(result).toThrow(ForbiddenException);
			expect(result).toThrow(expect.objectContaining({ response: { role: 'not allowed' } }));
		});

		it('should return True when context has UserRole and args User has privileges', () => {
			Reflect.defineMetadata('roles', [UserRole.Registered], handler);

			executionContext.getHandler.mockReturnValue(handler);
			httpArgumentsHost.getRequest.mockReturnValue({
				user: userFaker.makeOne({ role: UserRole.Admin }),
			});

			const result = guard.canActivate(executionContext);

			expect(result).toStrictEqual(true);
		});
	});
});
