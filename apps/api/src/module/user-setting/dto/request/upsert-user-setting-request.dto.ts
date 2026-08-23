import type { UpsertUserSettingRequest } from '@chesspecker/api-definitions';
import { IsDefined } from 'class-validator';

/**
 * The payload is stored as it comes: the database cannot know which board themes exist, so
 * the front validates it with `SettingPayload`.
 */
export class UpsertUserSettingRequestDto implements UpsertUserSettingRequest {
	@IsDefined()
	value!: unknown;
}
