import { IsNotEmpty, IsString } from 'class-validator';

import { LoginRequest } from '../../../../shared/definition/auth/request/login-request.interface';

export class LoginRequestDto implements LoginRequest {
	@IsString()
	@IsNotEmpty()
	username!: string;

	@IsString()
	@IsNotEmpty()
	password!: string;
}
