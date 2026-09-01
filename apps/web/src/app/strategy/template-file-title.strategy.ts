import { Injectable, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { Observable, Subscription, of } from 'rxjs';

import { GenderService } from '@app/service/gender.service';
import { TitleService } from '@app/service/title.service';

const APP_NAME = 'Chess Pecker';

@Injectable()
export class TemplatePageTitleStrategy extends TitleStrategy {
	private readonly title = inject(Title);
	private readonly titleService = inject(TitleService);
	private readonly transloco = inject(TranslocoService);
	private readonly genderService = inject(GenderService);

	private resolved: Subscription | null = null;

	override updateTitle(routerState: RouterStateSnapshot) {
		const key = this.buildTitle(routerState);

		if (key === undefined) {
			return;
		}

		this.titleService.setTitleKey(key);
		this.resolved?.unsubscribe();

		this.resolved = this.selectTitle(key).subscribe((title) => {
			this.title.setTitle(`${APP_NAME} | ${title}`.replace(/\s\|\s$/, ''));
		});
	}

	private selectTitle(key: string): Observable<string> {
		const params = { gender: this.genderService.selectedGender() };

		return '' === key ? of('') : this.transloco.selectTranslate<string>(key, params);
	}
}
