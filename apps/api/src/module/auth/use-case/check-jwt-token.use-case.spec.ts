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
import { JwtFaker, JwtFakerOptions } from '../factory/jwt.faker';

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

function signed(type: 'access' | 'refresh', lifetime: JwtFakerOptions): string {
	return JwtFaker.makeOne(
		{ sub: 'user-uuid', jti: 'uuid', iss: 'test', aud: `test-runner-${type}-token` },
		{ secret: 'secret', ...lifetime },
	);
}

describe('CheckJwtTokenUseCase', () => {
	let module: TestingModule;
	let useCase: CheckJwtTokenUseCase;

	const jwtServiceVerify = vi.spyOn(JwtService.prototype, 'verify');
	const jwtIssuedDate = new Date('2024-03-20T21:52:48.000Z');
	const validJwtDate = new Date('2024-03-20T22:10:42.000Z');
	const jwtNotBeforeDate = new Date('2024-03-20T22:07:48.000Z');
	const jwtExpirationDate = new Date('2024-04-04T21:52:48.000Z');
	const validAccessDate = new Date('2024-03-20T22:00:00.000Z');
	const accessExpirationDate = new Date('2024-03-20T22:07:48.000Z');
	const refreshLifetime: JwtFakerOptions = {
		issuedAt: jwtIssuedDate,
		notBefore: jwtNotBeforeDate,
		expiresAt: jwtExpirationDate,
	};
	const accessLifetime: JwtFakerOptions = {
		issuedAt: jwtIssuedDate,
		expiresAt: accessExpirationDate,
	};
	const fakeJwtRefreshToken = signed('refresh', refreshLifetime);
	const fakeJwtAccessToken = signed('access', accessLifetime);

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

	describe('execute, with an access token', () => {
		it('returns the claims of an access token while it lives', () => {
			vi.useFakeTimers().setSystemTime(validAccessDate);

			expect(useCase.execute(fakeJwtAccessToken, 'access')).toMatchObject({
				sub: 'user-uuid',
				aud: 'test-runner-access-token',
			});

			expect(jwtServiceVerify).toHaveBeenCalledTimes(1);
			expect(jwtServiceVerify).toHaveBeenCalledWith(fakeJwtAccessToken, {
				jwtid: 'uuid',
				audience: 'test-runner-access-token',
				issuer: 'test',
			});
		});

		it('refuses a refresh token presented as an access one', () => {
			vi.useFakeTimers().setSystemTime(validAccessDate);

			expect(() => useCase.execute(signed('refresh', accessLifetime), 'access')).toThrow(
				new JsonWebTokenError('jwt audience invalid. expected: test-runner-access-token'),
			);
		});

		it('refuses an access token presented as a refresh one', () => {
			vi.useFakeTimers().setSystemTime(validJwtDate);

			expect(() => useCase.execute(signed('access', refreshLifetime), 'refresh')).toThrow(
				new JsonWebTokenError('jwt audience invalid. expected: test-runner-refresh-token'),
			);
		});

		it('refuses an access token once it expired', () => {
			vi.useFakeTimers().setSystemTime(validJwtDate);

			expect(() => useCase.execute(fakeJwtAccessToken, 'access')).toThrow(
				new TokenExpiredError('jwt expired', accessExpirationDate),
			);
		});
	});
});
