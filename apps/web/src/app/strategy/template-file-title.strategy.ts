import { Injectable, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { ActivatedRouteSnapshot, RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { Observable, Subscription, of } from 'rxjs';

import type { RouteBack } from '@app/definition/route-back.type';
import { GenderService } from '@app/service/gender.service';
import { HeaderService } from '@app/service/header.service';

const APP_NAME = 'Chess Pecker';

@Injectable()
export class TemplatePageTitleStrategy extends TitleStrategy {
	private readonly title = inject(Title);
	private readonly headerService = inject(HeaderService);
	private readonly transloco = inject(TranslocoService);
	private readonly genderService = inject(GenderService);

	private resolved: Subscription | null = null;

	override updateTitle(routerState: RouterStateSnapshot) {
		this.headerService.setBackLink(this.buildBackLink(routerState.root));

		const key = this.buildTitle(routerState);

		if (key === undefined) {
			return;
		}

		this.headerService.setTitleKey(key);
		this.resolved?.unsubscribe();

		this.resolved = this.selectTitle(key).subscribe((title) => {
			this.title.setTitle(`${APP_NAME} | ${title}`.replace(/\s\|\s$/, ''));
		});
	}

	private buildBackLink(root: ActivatedRouteSnapshot): string | null {
		let params: Record<string, string> = {};
		let back: RouteBack | null = null;

		for (
			let route: ActivatedRouteSnapshot | null = root;
			null !== route;
			route = route.firstChild
		) {
			params = { ...params, ...route.params };
			back = this.readBack(route) ?? back;
		}

		if (null === back) {
			return null;
		}

		return 'string' === typeof back ? back : back(params);
	}

	private readBack(route: ActivatedRouteSnapshot): RouteBack | null {
		const back: unknown = route.routeConfig?.data?.['back'];

		return 'string' === typeof back || 'function' === typeof back ? (back as RouteBack) : null;
	}

	private selectTitle(key: string): Observable<string> {
		const params = { gender: this.genderService.selectedGender() };

		return '' === key ? of('') : this.transloco.selectTranslate<string>(key, params);
	}
}
