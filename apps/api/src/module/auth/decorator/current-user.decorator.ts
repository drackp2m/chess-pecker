import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import { Request } from 'express';

import { User } from '../../user/user.entity';

/**
 * El usuario que `JwtStrategyService.validate` dejó en la petición. Sólo tiene sentido en
 * rutas no marcadas con `@Public()`: allí el guard global ya ha garantizado que existe.
 */
export const CurrentUser = createParamDecorator(
	(_data: unknown, context: ExecutionContext): User => {
		const request = context.switchToHttp().getRequest<Request & { user: User }>();

		return request.user;
	},
);
