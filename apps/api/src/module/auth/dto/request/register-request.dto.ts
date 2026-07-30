import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

import { RegisterRequest } from '../../../../shared/definition/auth/request/register-request.interface';
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
