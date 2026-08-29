import type { GetSentPuzzleSharesRequest } from '@chesspecker/api-definitions';
import { Type } from 'class-transformer';
import { IsDate, IsInt, IsOptional, Max, Min } from 'class-validator';

export class GetSentPuzzleSharesRequestDto implements GetSentPuzzleSharesRequest<Date> {
	/** Where the mirror got to: the `updatedAt` of the last challenge it wrote down. */
	@IsOptional()
	@Type(() => Date)
	@IsDate()
	since?: Date;

	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(200)
	limit?: number;
}
