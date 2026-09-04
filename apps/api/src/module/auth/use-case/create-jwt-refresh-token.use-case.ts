import { Inject, Injectable } from '@nestjs/common';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';

import { ConfigurationService } from '../../../shared/module/config/configuration.service';

@Injectable()
export class CreateJwtRefreshTokenUseCase {
	constructor(
		@Inject(JwtService)
		private readonly jwtService: JwtService,
		@Inject(ConfigurationService)
		private readonly configurationService: ConfigurationService,
	) {}

	execute(userUuid: string): string {
		// Registered claims belong in the sign options. `notBefore` is the access-token
		// lifetime, so this only becomes valid once that one has expired.
		return this.jwtService.sign(
			{},
			{
				subject: userUuid,
				audience: `${this.configurationService.jwt.audience}-refresh-token`,
				expiresIn: this.configurationService.jwt.refreshTokenExpiresIn as NonNullable<
					JwtSignOptions['expiresIn']
				>,
				notBefore: this.configurationService.jwt.accessTokenExpiresIn as NonNullable<
					JwtSignOptions['notBefore']
				>,
			},
		);
	}
}
