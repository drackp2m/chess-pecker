import { Inject, Injectable, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import type { CookieOptions, Request } from 'express';

import { ConfigurationService } from '../../../shared/module/config/configuration.service';
import { getEnumKey } from '../../../shared/util/get-enum-key.util';
import { JwtCookie } from '../definition/jwt-cookie.enum';
import { JwtEndpoints } from '../definition/jwt-endpoints.enum';
import { jwtCookiePath } from '../util/jwt-cookie-path.util';

@Injectable({ scope: Scope.REQUEST })
export class LogoutUseCase {
	constructor(
		@Inject(REQUEST)
		private readonly request: Request,
		@Inject(ConfigurationService)
		private readonly configService: ConfigurationService,
	) {}

	execute(): void {
		this.clearCookie(JwtCookie.access);
		this.clearCookie(JwtCookie.refresh);
	}

	/**
	 * Both variants are expired because `API_COOKIE_DOMAIN` may have changed between sessions:
	 * a host cookie and a domain cookie are two different cookies, and the stale one survives.
	 */
	private clearCookie(tokenType: JwtCookie): void {
		const enumKey = getEnumKey(JwtCookie, tokenType);

		if (undefined !== enumKey) {
			const path = jwtCookiePath(this.configService.api.prefix, JwtEndpoints[enumKey]);
			const cookieDomain = this.configService.api.cookieDomain;
			const baseOptions: CookieOptions = {
				signed: true,
				secure: true,
				httpOnly: true,
				sameSite: 'lax',
				path,
			} as const;

			this.request.res?.clearCookie(tokenType, baseOptions);
			this.request.res?.clearCookie(tokenType, {
				...baseOptions,
				domain: '' === cookieDomain ? this.request.hostname : cookieDomain,
			});
		}
	}
}
