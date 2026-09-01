import { Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslocoService } from '@jsverse/transloco';
import { asapScheduler, observeOn } from 'rxjs';

import type { TranslationRef } from '@app/definition/i18n.type';
import type { I18nParamsArg } from '@app/i18n';
import { GenderService } from '@app/service/gender.service';

@Injectable({ providedIn: 'root' })
export class I18nService {
	private readonly transloco = inject(TranslocoService);
	private readonly genderService = inject(GenderService);

	private readonly event = signal(0);

	constructor() {
		this.transloco.events$.pipe(observeOn(asapScheduler), takeUntilDestroyed()).subscribe(() => {
			this.event.update((count) => count + 1);
		});
	}

	translate<Key extends string>(key: Key, ...params: I18nParamsArg<Key>): string;
	translate(key: string, params?: Record<string, unknown>): string {
		this.event();

		return this.transloco.translate(key, this.withGender(params));
	}

	resolve(ref: TranslationRef): string {
		this.event();

		return this.transloco.translate(ref.key, this.withGender(ref.params));
	}

	private withGender(params?: Record<string, unknown>): Record<string, unknown> {
		return { gender: this.genderService.selectedGender(), ...params };
	}
}
