import { faker } from '@faker-js/faker';
import { JwtService } from '@nestjs/jwt';

import { JsonWebToken } from '../definition/json-web-token.interface';

const LIFETIME_MS = 15 * 60 * 1000;

export interface JwtFakerOptions {
	secret?: string;
	issuedAt?: Date;
	notBefore?: Date;
	expiresAt?: Date;
}

function toSeconds(date: Date): number {
	return Math.floor(date.getTime() / 1000);
}

export class JwtFaker {
	static makeOne(overrides?: Partial<JsonWebToken>, options?: JwtFakerOptions): string {
		const issuedAt = options?.issuedAt ?? new Date();
		const payload: JsonWebToken = {
			sub: faker.string.uuid(),
			jti: faker.string.uuid(),
			iss: faker.internet.domainName(),
			aud: `${faker.word.noun()}-access-token`,
			iat: toSeconds(issuedAt),
			nbf: toSeconds(options?.notBefore ?? issuedAt),
			exp: toSeconds(options?.expiresAt ?? new Date(issuedAt.getTime() + LIFETIME_MS)),
			...overrides,
		};
		const secret = options?.secret ?? faker.string.alphanumeric(32);

		return new JwtService({ secret }).sign(payload, { algorithm: 'HS512' });
	}
}
