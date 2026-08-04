import type { LoginRequest } from '@chesspecker/api-definitions';
import { IsNotEmpty, IsString } from 'class-validator';

export class LoginRequestDto implements LoginRequest {
	@IsString()
	@IsNotEmpty()
	username!: string;

	@IsString()
	@IsNotEmpty()
	password!: string;
}
