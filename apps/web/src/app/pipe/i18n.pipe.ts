import { Pipe, PipeTransform, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

import type { I18nParamsArg } from '@app/i18n';
import { GenderService } from '@app/service/gender.service';

@Pipe({ name: 'i18n', pure: false })
export class I18nPipe extends TranslocoPipe implements PipeTransform {
	private readonly genderService = inject(GenderService);

	override transform<Key extends string>(key: Key, ...params: I18nParamsArg<Key>): string;
	override transform(key: string, params?: Record<string, unknown>): string {
		return super.transform(key, { gender: this.genderService.selectedGender(), ...params });
	}
}
