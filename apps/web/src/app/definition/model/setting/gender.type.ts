import { I18n } from '@app/i18n';

export type Gender = 'male' | 'female' | 'other';

export const GENDERS: readonly Gender[] = ['male', 'female', 'other'];

export const DEFAULT_GENDER: Gender = 'other';

export const GENDER_LABEL = {
	male: I18n.setting.GENDER_MALE,
	female: I18n.setting.GENDER_FEMALE,
	other: I18n.setting.GENDER_OTHER,
} as const satisfies Record<Gender, string>;

export function normalizeGender(value: unknown): Gender {
	return GENDERS.includes(value as Gender) ? (value as Gender) : DEFAULT_GENDER;
}
