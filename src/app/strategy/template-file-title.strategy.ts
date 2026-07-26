import { Injectable, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';

import { TitleService } from '@app/service/title.service';

@Injectable()
export class TemplatePageTitleStrategy extends TitleStrategy {
	private readonly title = inject(Title);
	private readonly titleService = inject(TitleService);

	override updateTitle(routerState: RouterStateSnapshot) {
		const title = this.buildTitle(routerState);

		if (title !== undefined) {
			this.titleService.setTitle(title);
			this.title.setTitle(`Round Timer | ${title}`.replace(/\s\|\s$/, ''));
		}
	}
}
