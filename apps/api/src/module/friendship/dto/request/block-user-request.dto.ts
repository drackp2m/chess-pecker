import type { BlockUserRequest } from '@chesspecker/api-definitions';
import { IsNotEmpty, IsString } from 'class-validator';

export class BlockUserRequestDto implements BlockUserRequest {
	@IsString()
	@IsNotEmpty()
	username!: string;
}
