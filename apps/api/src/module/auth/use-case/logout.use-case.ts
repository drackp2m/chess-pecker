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
		@Inject(REQUEST) private readonly request: Request,
		private readonly configService: ConfigurationService,
	) {}

	execute(): void {
		this.clearCookie(JwtCookie.access);
		this.clearCookie(JwtCookie.refresh);
	}

	/**
	 * Borrar una cookie es volver a mandarla caducada, y el navegador sólo la reconoce como
	 * la misma si coinciden nombre, `path` y `domain`. Como `API_COOKIE_DOMAIN` puede haber
	 * cambiado entre sesiones (vacío da una cookie de host, con valor da una de dominio, y
	 * son dos cookies distintas para el navegador), se caducan las dos variantes. Sin esto la
	 * que quedó de la configuración anterior sobrevive al logout y mantiene la sesión viva: el
	 * endpoint responde 204, pero al refrescar la página `me` sigue contestando 200. Cuando no
	 * hay dominio configurado se usa el del propio host, que es el que habría tenido la cookie.
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
