import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { ConfigurationService } from '../../../shared/module/config/configuration.service';
import { JsonWebToken } from '../definition/json-web-token.interface';

@Injectable()
export class CheckJwtTokenUseCase {
	constructor(
		@Inject(JwtService)
		private readonly jwtService: JwtService,
		@Inject(ConfigurationService)
		private readonly configurationService: ConfigurationService,
	) {}

	execute(token: string, type: 'access' | 'refresh'): JsonWebToken {
		return this.jwtService.verify(token, {
			jwtid: this.configurationService.jwt.id,
			audience: `${this.configurationService.jwt.audience}-${type}-token`,
			issuer: this.configurationService.jwt.issuer,
		});
	}
}
