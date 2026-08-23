import type { SyncTimestamps } from '@chesspecker/api-definitions';
import { Type } from 'class-transformer';
import { IsDate, IsOptional } from 'class-validator';

/**
 * Dates travel from the client because they are domain data: weeks of training without an
 * account would collapse onto the registration date. Missing ones fall back to the server's.
 */
export class SyncTimestampsDto implements SyncTimestamps<Date> {
	@IsOptional()
	@Type(() => Date)
	@IsDate()
	createdAt?: Date;

	@IsOptional()
	@Type(() => Date)
	@IsDate()
	updatedAt?: Date;
}
