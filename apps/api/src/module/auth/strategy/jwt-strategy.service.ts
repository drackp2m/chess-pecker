import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { ExtractJwt, Strategy, StrategyOptions } from 'passport-jwt';

import { ConfigurationService } from '../../../shared/module/config/configuration.service';
import { User } from '../../user/user.entity';
import { UserRepository } from '../../user/user.repository';
import { JsonWebToken } from '../definition/json-web-token.interface';
import { JwtCookie } from '../definition/jwt-cookie.enum';

@Injectable()
export class JwtStrategyService extends PassportStrategy(Strategy) {
	constructor(
		// FixMe => configurationService private crash with "Property is declared but its value is never read"
		protected readonly configurationService: ConfigurationService,
		private readonly userRepository: UserRepository,
	) {
		super({
			jwtFromRequest: ExtractJwt.fromExtractors([
				(request: Request) => request.signedCookies[JwtCookie.access] ?? null,
			]),
			secretOrKey: configurationService.jwt.secret,
			ignoreExpiration: false,
		} as StrategyOptions);
	}

	async validate(jwt: JsonWebToken): Promise<User> {
		return await this.userRepository.getOne({ uuid: jwt.sub });
	}
}
