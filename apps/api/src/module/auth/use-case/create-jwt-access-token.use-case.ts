import { Injectable } from '@nestjs/common';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';

import { ConfigurationService } from '../../../shared/module/config/configuration.service';

@Injectable()
export class CreateJwtAccessTokenUseCase {
	constructor(
		private readonly jwtService: JwtService,
		private readonly configurationService: ConfigurationService,
	) {}

	execute(userUuid: string): string {
		// These are JWT *registered claims* -> they must go in the sign options
		// (2nd arg) so they become `sub`/`aud`/`exp`/`nbf`. Put in the payload
		// (1st arg) they'd be plain fields and the token would carry no `sub`/`exp`.
		return this.jwtService.sign(
			{},
			{
				subject: userUuid,
				audience: `${this.configurationService.jwt.audience}-access-token`,
				expiresIn: this.configurationService.jwt.accessTokenExpiresIn as NonNullable<
					JwtSignOptions['expiresIn']
				>,
				notBefore: 0,
			},
		);
	}
}
