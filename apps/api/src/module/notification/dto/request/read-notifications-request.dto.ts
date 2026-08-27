import type { ReadNotificationsRequest } from '@chesspecker/api-definitions';
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsUUID } from 'class-validator';

export class ReadNotificationsRequestDto implements ReadNotificationsRequest {
	@IsArray()
	@ArrayNotEmpty()
	@ArrayMaxSize(100)
	@IsUUID(undefined, { each: true })
	uuids!: string[];
}
