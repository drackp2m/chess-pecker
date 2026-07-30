import { CustomDecorator, SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marks a route (or a whole controller/resolver) as reachable without a valid
 * JWT, so the global `JwtGuard` lets it through. Needed for the auth entry
 * points (register / login / refresh-session) and public health endpoints.
 */
export const Public = (): CustomDecorator => SetMetadata(IS_PUBLIC_KEY, true);
