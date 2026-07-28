import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

import { ForbiddenException } from '../../../shared/exception/forbidden.exception';
import { UnauthorizedException } from '../../../shared/exception/unauthorized-exception.exception';
import { UserRole } from '../../user/definition/user-role.enum';
import { User } from '../../user/user.entity';

@Injectable()
export class RolesGuard implements CanActivate {
	canActivate(context: ExecutionContext): Promise<boolean> {
		const roles = new Reflector().get<UserRole[]>('roles', context.getHandler());

		const request = context.switchToHttp().getRequest<Request & { user: User }>();
		const user = request.user;

		if (!(user instanceof User)) {
			throw new UnauthorizedException('x-jwt-access-token invalid', 'authorization');
		}

		if (0 === roles.length) {
			return new Promise((resolve) => resolve.apply(true));
		}

		const hasRole = user.role === UserRole.Admin || roles.includes(user.role);

		if (hasRole) {
			return new Promise((resolve) => resolve.apply(true));
		}

		throw new ForbiddenException('not allowed', 'role');
	}
}
