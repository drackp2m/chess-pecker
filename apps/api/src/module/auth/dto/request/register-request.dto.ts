import type { RegisterRequest } from '@chesspecker/api-definitions';
import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

import { IsUniqueUserProp } from '../../../user/decorator/is-unique-user-prop.decorator';

export class RegisterRequestDto implements RegisterRequest {
	@IsString()
	@IsNotEmpty()
	@IsUniqueUserProp('username')
	username!: string;

	@IsString()
	@IsNotEmpty()
	password!: string;

	@IsOptional()
	@IsEmail()
	@IsUniqueUserProp('email')
	email?: string;
}
