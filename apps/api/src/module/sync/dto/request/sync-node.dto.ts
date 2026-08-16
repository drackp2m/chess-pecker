import type { SyncNode } from '@chesspecker/api-definitions';
import { IsOptional, IsUUID } from 'class-validator';

import { SyncTimestampsDto } from '../../../training/dto/request/sync-timestamps.dto';

/**
 * Los dos nombres que puede llevar una fila: el que le puso el dispositivo donde nació y el
 * que le dio el servidor si ya subió alguna vez. Los dos son opcionales por separado, pero
 * uno de los dos tiene que venir; sin ninguno la fila no se puede identificar y la petición
 * se rechaza entera.
 */
export class SyncNodeDto extends SyncTimestampsDto implements SyncNode<Date> {
	@IsOptional()
	@IsUUID()
	clientRef?: string;

	@IsOptional()
	@IsUUID()
	uuid?: string;
}
