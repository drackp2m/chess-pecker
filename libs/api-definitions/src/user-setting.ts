import { z } from 'zod';

/**
 * The payload is wrapped rather than bare, so a scalar setting can gain fields later without
 * changing the column's type.
 */
export interface SettingValue<T = unknown> {
	value: T;
}

export interface UserSetting {
	readonly uuid: string;
	readonly key: string;
	readonly value: SettingValue;
	readonly createdAt: string;
	readonly updatedAt: string;
}

export interface UpsertUserSettingRequest {
	value: unknown;
}

export const upsertUserSettingRequestSchema = z.object({
	value: z.unknown(),
});
