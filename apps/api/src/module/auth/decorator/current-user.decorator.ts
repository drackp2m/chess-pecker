import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import { Request } from 'express';

import { User } from '../../user/user.entity';

/**
 * The user `JwtStrategyService.validate` left on the request. Only meaningful on routes
 * without `@Public()`, where the global guard has already guaranteed one.
 */
export const CurrentUser = createParamDecorator(
	(_data: unknown, context: ExecutionContext): User => {
		const request = context.switchToHttp().getRequest<Request & { user: User }>();

		return request.user;
	},
);
