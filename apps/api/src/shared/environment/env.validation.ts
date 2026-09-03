import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { config } from 'dotenv';
import { z } from 'zod';

function workspaceRoot(): string {
	let current = process.cwd();

	while (!existsSync(join(current, 'pnpm-workspace.yaml'))) {
		const parent = dirname(current);

		if (parent === current) {
			return process.cwd();
		}

		current = parent;
	}

	return current;
}

config({ path: join(workspaceRoot(), '.env') });

const environmentSchema = z.object({
	NODE_ENV: z.enum(['production', 'development', 'test']),
	DB_HOST: z.string().min(1),
	DB_PORT: z.coerce.number(),
	DB_USER: z.string().min(1),
	DB_PASS: z.string().min(1),
	DB_NAME: z.string().min(1),
	DB_NAME_TEST: z.string().min(1),
	DB_CERT: z.string().min(1),
	API_PROTOCOL: z.enum(['https', 'http']),
	API_DOMAIN: z.string().min(1),
	API_PORT: z.coerce.number(),
	API_PREFIX: z.string().min(1),
	API_DEBUG_PORT: z.coerce.number().optional(),
	API_CORS_ALLOWED_DOMAINS: z.string().min(1),
	API_COOKIE_SECRET: z.string().min(1),
	API_COOKIE_DOMAIN: z.string().min(1),
	JWT_ID: z.string().min(1),
	JWT_ALGORITHM: z.enum([
		'HS256',
		'HS384',
		'HS512',
		'RS256',
		'RS384',
		'RS512',
		'ES256',
		'ES384',
		'ES512',
		'PS256',
		'PS384',
		'PS512',
	]),
	JWT_ISSUER: z.string().min(1),
	JWT_AUDIENCE: z.string().min(1),
	JWT_ACCESS_TOKEN_EXPIRES_IN: z.string().min(1),
	JWT_REFRESH_TOKEN_EXPIRES_IN: z.string().min(1),
	JWT_SECRET: z.string().min(1),
});

export function validate(config: Record<string, unknown>): z.output<typeof environmentSchema> {
	const result = environmentSchema.safeParse(config);

	if (!result.success) {
		throw new Error(z.prettifyError(result.error));
	}

	return result.data;
}
