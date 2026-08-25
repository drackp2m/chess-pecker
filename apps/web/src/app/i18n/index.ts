import type { Provider } from '@angular/core';
import { provideTranslocoScope } from '@jsverse/transloco';

import type { TranslationRef } from '@app/definition/i18n.type';
import { AuthI18n } from '@app/i18n/auth/keys';
import type { AuthI18nParams } from '@app/i18n/auth/params';
import { DashboardI18n } from '@app/i18n/dashboard/keys';
import type { DashboardI18nParams } from '@app/i18n/dashboard/params';
import { IntroI18n } from '@app/i18n/intro/keys';
import type { IntroI18nParams } from '@app/i18n/intro/params';
import { CommonI18n } from '@app/i18n/keys';
import { MatchI18n } from '@app/i18n/match/keys';
import type { MatchI18nParams } from '@app/i18n/match/params';
import type { CommonI18nParams } from '@app/i18n/params';
import { ProfileI18n } from '@app/i18n/profile/keys';
import type { ProfileI18nParams } from '@app/i18n/profile/params';
import { PuzzleI18n } from '@app/i18n/puzzle/keys';
import type { PuzzleI18nParams } from '@app/i18n/puzzle/params';
import { SettingI18n } from '@app/i18n/setting/keys';
import type { SettingI18nParams } from '@app/i18n/setting/params';
import { TrainingI18n } from '@app/i18n/training/keys';
import type { TrainingI18nParams } from '@app/i18n/training/params';

export const I18n = {
	auth: AuthI18n,
	common: CommonI18n,
	dashboard: DashboardI18n,
	intro: IntroI18n,
	match: MatchI18n,
	profile: ProfileI18n,
	puzzle: PuzzleI18n,
	setting: SettingI18n,
	training: TrainingI18n,
} as const;

type I18nParams = AuthI18nParams &
	CommonI18nParams &
	DashboardI18nParams &
	IntroI18nParams &
	MatchI18nParams &
	ProfileI18nParams &
	PuzzleI18nParams &
	SettingI18nParams &
	TrainingI18nParams;

type KeyValues<T> = { [Scope in keyof T]: T[Scope][keyof T[Scope]] }[keyof T];

type ScopeOf<T> = T extends `${infer Scope}.${string}` ? Scope : never;

export type I18nScope = ScopeOf<KeyValues<typeof I18n>>;

export type I18nParamsArg<Key> = string extends Key
	? [params?: Record<string, unknown>]
	: Key extends keyof I18nParams
		? [params: I18nParams[Key]]
		: [];

export const provideI18nScope = (...scopes: I18nScope[]): Provider[] =>
	provideTranslocoScope(...scopes);

export function i18nRef<Key extends string>(
	key: Key,
	...params: I18nParamsArg<Key>
): TranslationRef;
export function i18nRef(key: string, params?: Record<string, unknown>): TranslationRef {
	return undefined === params ? { key } : { key, params };
}
