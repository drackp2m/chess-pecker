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
		// Registered claims belong in the sign options, or they become plain payload fields
		// and the token carries no `sub`/`exp`.
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
