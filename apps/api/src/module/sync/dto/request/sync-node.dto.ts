import type { SyncNode } from '@chesspecker/api-definitions';
import { IsOptional, IsUUID } from 'class-validator';

import { SyncTimestampsDto } from '../../../training/dto/request/sync-timestamps.dto';

/**
 * The two names a row can carry: the device's and the server's. Each is optional alone, but
 * one has to come or the row cannot be identified and the whole request is refused.
 */
export class SyncNodeDto extends SyncTimestampsDto implements SyncNode<Date> {
	@IsOptional()
	@IsUUID()
	clientRef?: string;

	@IsOptional()
	@IsUUID()
	uuid?: string;
}
