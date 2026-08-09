import { Injectable, inject } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';

import type { TranslationRef } from '@app/definition/i18n.type';
import type { I18nParamsArg } from '@app/i18n';

@Injectable({ providedIn: 'root' })
export class I18nService {
	private readonly transloco = inject(TranslocoService);

	translate<Key extends string>(key: Key, ...params: I18nParamsArg<Key>): string;
	translate(key: string, params?: Record<string, unknown>): string {
		return this.transloco.translate(key, params);
	}

	resolve(ref: TranslationRef): string {
		return this.transloco.translate(ref.key, ref.params);
	}
}
