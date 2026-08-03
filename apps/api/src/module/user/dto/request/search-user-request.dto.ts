import type { SearchUserRequest } from '@chesspecker/api-definitions';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';

export class SearchUserRequestDto implements SearchUserRequest {
	@IsString()
	@IsNotEmpty()
	username!: string;

	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(25)
	limit?: number;
}
