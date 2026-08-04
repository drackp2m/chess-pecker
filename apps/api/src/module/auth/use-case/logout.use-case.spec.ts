import { REQUEST } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { Request, Response } from 'express';
import { mock } from 'vitest-mock-extended';

import { ConfigurationService } from '../../../shared/module/config/configuration.service';

import { LogoutUseCase } from './logout.use-case';

describe('LogoutUseCase', () => {
	let useCase: LogoutUseCase;

	const response = mock<Response>();
	const request = mock<Request>({ res: response });
	const configurationService = mock<ConfigurationService>({
		jwt: {
			secret: 'secret',
			id: 'uuid',
			audience: 'test-runner',
			issuer: 'test',
		},
		api: {
			cookieDomain: 'localhost',
			prefix: '/api',
		},
	});

	const requestResponseClearCookie = response.clearCookie;

	beforeAll(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				LogoutUseCase,
				{ provide: REQUEST, useValue: request },
				{ provide: ConfigurationService, useValue: configurationService },
			],
		}).compile();

		useCase = await module.resolve(LogoutUseCase);
	});

	it('should be defined', () => {
		expect(useCase).toBeDefined();
	});

	describe('execute', () => {
		// Dos por token: la variante de host y la de dominio. Una cookie guardada con
		// `Domain` es otra cookie para el navegador, y caducar sólo una deja viva a la otra.
		it('should expire both the host and the domain variant of each token', () => {
			useCase.execute();

			expect(requestResponseClearCookie).toHaveBeenCalledTimes(4);

			const accessOptions = {
				signed: true,
				secure: true,
				httpOnly: true,
				sameSite: 'lax',
				path: '/api',
			};
			const refreshOptions = { ...accessOptions, path: '/api/auth/refresh-session' };

			expect(requestResponseClearCookie).toHaveBeenNthCalledWith(
				1,
				'x-jwt-access-token',
				accessOptions,
			);
			expect(requestResponseClearCookie).toHaveBeenNthCalledWith(2, 'x-jwt-access-token', {
				...accessOptions,
				domain: 'localhost',
			});
			expect(requestResponseClearCookie).toHaveBeenNthCalledWith(
				3,
				'x-jwt-refresh-token',
				refreshOptions,
			);
			expect(requestResponseClearCookie).toHaveBeenNthCalledWith(4, 'x-jwt-refresh-token', {
				...refreshOptions,
				domain: 'localhost',
			});
		});
	});
});
