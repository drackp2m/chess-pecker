import { Injectable } from '@nestjs/common';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';

import { ConfigurationService } from '../../../shared/module/config/configuration.service';

@Injectable()
export class CreateJwtRefreshTokenUseCase {
	constructor(
		private readonly jwtService: JwtService,
		private readonly configurationService: ConfigurationService,
	) {}

	execute(userUuid: string): string {
		// Registered claims belong in the sign options (2nd arg) so they become
		// `sub`/`aud`/`exp`/`nbf`. `notBefore` = access-token lifetime: the refresh
		// token only becomes valid once the access token has expired.
		return this.jwtService.sign(
			{},
			{
				subject: userUuid,
				audience: `${this.configurationService.jwt.audience}-refresh-token`,
				expiresIn: this.configurationService.jwt
					.refreshTokenExpiresIn as JwtSignOptions['expiresIn'],
				notBefore: this.configurationService.jwt
					.accessTokenExpiresIn as JwtSignOptions['notBefore'],
			},
		);
	}
}
