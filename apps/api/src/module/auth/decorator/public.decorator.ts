import { CustomDecorator, SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marks a route as reachable without a valid JWT, so the global `JwtGuard` lets it through:
 * the auth entry points and the public health endpoints.
 */
export const Public = (): CustomDecorator => SetMetadata(IS_PUBLIC_KEY, true);
