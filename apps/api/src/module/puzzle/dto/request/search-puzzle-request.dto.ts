import type { SearchPuzzleRequest } from '@chesspecker/api-definitions';
import { Transform, Type } from 'class-transformer';
import { IsArray, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class SearchPuzzleRequestDto implements SearchPuzzleRequest {
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(0)
	ratingMin?: number;

	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(0)
	ratingMax?: number;

	@IsOptional()
	@Transform(({ value }) => (Array.isArray(value) ? (value as string[]) : String(value).split(',')))
	@IsArray()
	@IsString({ each: true })
	themes?: string[];

	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(500)
	limit?: number;

	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(0)
	offset?: number;
}
