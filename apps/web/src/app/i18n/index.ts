import type { Provider } from '@angular/core';
import { provideTranslocoScope } from '@jsverse/transloco';

import type { TranslationRef } from '@app/definition/i18n.type';
import { DashboardI18n } from '@app/i18n/dashboard/keys';
import { CommonI18n } from '@app/i18n/keys';
import type { I18nParams } from '@app/i18n/params';

export const I18n = {
	common: CommonI18n,
	dashboard: DashboardI18n,
} as const;

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
