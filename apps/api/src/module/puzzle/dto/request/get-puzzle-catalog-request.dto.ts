import type { GetPuzzleCatalogRequest } from '@chesspecker/api-definitions';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class GetPuzzleCatalogRequestDto implements GetPuzzleCatalogRequest {
	@IsOptional()
	@IsString()
	after?: string;

	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(500)
	limit?: number;
}
