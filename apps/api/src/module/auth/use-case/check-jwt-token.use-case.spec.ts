import {
	JsonWebTokenError,
	JwtModule,
	JwtService,
	NotBeforeError,
	TokenExpiredError,
} from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'vitest-mock-extended';

import { ConfigurationService } from '../../../shared/module/config/configuration.service';
import { JwtFactory } from '../../../shared/module/config/factory/jwt.factory';

import { CheckJwtTokenUseCase } from './check-jwt-token.use-case';

function shiftedDate(date: Date, unit: 'day' | 'month', amount: number): Date {
	const shifted = new Date(date);

	if ('day' === unit) {
		shifted.setUTCDate(shifted.getUTCDate() + amount);
	} else {
		shifted.setUTCMonth(shifted.getUTCMonth() + amount);
	}

	return shifted;
}

describe('CheckJwtRefreshTokenUseCase', () => {
	let module: TestingModule;
	let useCase: CheckJwtTokenUseCase;

	const jwtServiceVerify = vi.spyOn(JwtService.prototype, 'verify');
	const validJwtDate = new Date('2024-03-20T22:10:42.000Z');
	const jwtNotBeforeDate = new Date('2024-03-20T22:07:48.000Z');
	const jwtExpirationDate = new Date('2024-04-04T21:52:48.000Z');
	const fakeJwtRefreshToken =
		'eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3MTA5NzE1NjgsIm5iZiI6MTcxMDk3MjQ2OCwiZXhwIjoxNzEyMjY3NTY4LCJhdWQiOiJ0ZXN0LXJ1bm5lci1yZWZyZXNoLXRva2VuIiwiaXNzIjoidGVzdCIsInN1YiI6InVzZXItdXVpZCIsImp0aSI6InV1aWQifQ.2hP7NbBjKGpUJ3rPLFo3qIhpTeSAVwl7uTW1gd4n1lutBpEwxIcSmi_WALMENNq9yl4Lkf2vjbhGxsLhx7WJJQ';

	const prepareTestingModule = async (
		configurationService: ConfigurationService,
	): Promise<void> => {
		module = await Test.createTestingModule({
			imports: [
				JwtModule.registerAsync({
					useFactory: () => new JwtFactory(configurationService).createJwtOptions(),
				}),
			],
			providers: [
				CheckJwtTokenUseCase,
				{ provide: ConfigurationService, useValue: configurationService },
			],
		}).compile();

		useCase = await module.resolve(CheckJwtTokenUseCase);
	};

	beforeEach(async () => {
		const configurationService = mock<ConfigurationService>({
			jwt: {
				secret: 'secret',
				id: 'uuid',
				audience: 'test-runner',
				issuer: 'test',
			},
		});

		await prepareTestingModule(configurationService);
	});

	it('should be defined', () => {
		expect(useCase).toBeDefined();
	});

	// ToDo => add tests for accessToken

	describe('execute', () => {
		it('throw JsonWebTokenError with "invalid signature" when secret is not valid', async () => {
			const configurationService = mock<ConfigurationService>({
				jwt: {
					secret: 'invalid secret',
					id: 'uuid',
					audience: 'test-runner',
					issuer: 'test',
				},
			});

			await prepareTestingModule(configurationService);

			expect(() => useCase.execute(fakeJwtRefreshToken, 'refresh')).toThrow(
				new JsonWebTokenError('invalid signature'),
			);

			expect(jwtServiceVerify).toHaveBeenCalledTimes(1);
			expect(jwtServiceVerify).toHaveBeenCalledWith(fakeJwtRefreshToken, {
				jwtid: 'uuid',
				audience: 'test-runner-refresh-token',
				issuer: 'test',
			});
		});

		it('throw JsonWebTokenError with "jwt jwtid invalid" when id is not valid', async () => {
			vi.useFakeTimers().setSystemTime(validJwtDate);

			const configurationService = mock<ConfigurationService>({
				jwt: {
					secret: 'secret',
					id: 'iduu',
					audience: 'test-runner',
					issuer: 'test',
				},
			});

			await prepareTestingModule(configurationService);

			expect(() => useCase.execute(fakeJwtRefreshToken, 'refresh')).toThrow(
				new JsonWebTokenError('jwt jwtid invalid. expected: iduu'),
			);

			expect(jwtServiceVerify).toHaveBeenCalledTimes(1);
			expect(jwtServiceVerify).toHaveBeenCalledWith(fakeJwtRefreshToken, {
				jwtid: 'iduu',
				audience: 'test-runner-refresh-token',
				issuer: 'test',
			});
		});

		it('throw JsonWebTokenError with "jwt audience invalid" when audience is not valid', async () => {
			vi.useFakeTimers().setSystemTime(validJwtDate);

			const configurationService = mock<ConfigurationService>({
				jwt: {
					secret: 'secret',
					id: 'uuid',
					audience: 'test-mock',
					issuer: 'test',
				},
			});

			await prepareTestingModule(configurationService);

			expect(() => useCase.execute(fakeJwtRefreshToken, 'refresh')).toThrow(
				new JsonWebTokenError('jwt audience invalid. expected: test-mock-refresh-token'),
			);

			expect(jwtServiceVerify).toHaveBeenCalledTimes(1);
			expect(jwtServiceVerify).toHaveBeenCalledWith(fakeJwtRefreshToken, {
				jwtid: 'uuid',
				audience: 'test-mock-refresh-token',
				issuer: 'test',
			});
		});

		it('throw JsonWebTokenError with "jwt issuer invalid" when audience is not valid', async () => {
			vi.useFakeTimers().setSystemTime(validJwtDate);

			const configurationService = mock<ConfigurationService>({
				jwt: {
					secret: 'secret',
					id: 'uuid',
					audience: 'test-runner',
					issuer: 'spec',
				},
			});

			await prepareTestingModule(configurationService);

			expect(() => useCase.execute(fakeJwtRefreshToken, 'refresh')).toThrow(
				new JsonWebTokenError('jwt issuer invalid. expected: spec'),
			);

			expect(jwtServiceVerify).toHaveBeenCalledTimes(1);
			expect(jwtServiceVerify).toHaveBeenCalledWith(fakeJwtRefreshToken, {
				jwtid: 'uuid',
				audience: 'test-runner-refresh-token',
				issuer: 'spec',
			});
		});

		it('throw JsonWebTokenError with "jwt not active" when system date is below jwt notBefore time', () => {
			vi.useFakeTimers().setSystemTime(shiftedDate(validJwtDate, 'day', -1));

			expect(() => useCase.execute(fakeJwtRefreshToken, 'refresh')).toThrow(
				new NotBeforeError('jwt not active', jwtNotBeforeDate),
			);

			expect(jwtServiceVerify).toHaveBeenCalledTimes(1);
			expect(jwtServiceVerify).toHaveBeenCalledWith(fakeJwtRefreshToken, {
				jwtid: 'uuid',
				audience: 'test-runner-refresh-token',
				issuer: 'test',
			});
		});

		it('throw JsonWebTokenError with "jwt not active" when system date is above jwt expiration time', () => {
			vi.useFakeTimers().setSystemTime(shiftedDate(validJwtDate, 'month', 1));

			expect(() => useCase.execute(fakeJwtRefreshToken, 'refresh')).toThrow(
				new TokenExpiredError('jwt expired', jwtExpirationDate),
			);

			expect(jwtServiceVerify).toHaveBeenCalledTimes(1);
			expect(jwtServiceVerify).toHaveBeenCalledWith(fakeJwtRefreshToken, {
				jwtid: 'uuid',
				audience: 'test-runner-refresh-token',
				issuer: 'test',
			});
		});
	});
});
