import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Routes, TitleStrategy, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { afterEach, describe, expect, it } from 'vitest';

import type { RouteBack } from '@app/definition/route-back.type';
import { HeaderService } from '@app/service/header.service';
import { TemplatePageTitleStrategy } from '@app/strategy/template-file-title.strategy';
import { provideTestingI18n } from '@app/testing/i18n.harness';

@Component({ template: '' })
class BlankPage {}

const ROUTES: Routes = [
	{ path: '', title: '', component: BlankPage },
	{ path: 'untitled', data: { back: '/' }, component: BlankPage },
	{ path: 'training/solve', title: 'SOLVING', data: { back: '/training' }, component: BlankPage },
	{
		path: 'bookmarks/:type',
		data: { back: '/profile' },
		children: [
			{ path: '', title: 'BOOKMARKS', component: BlankPage },
			{
				path: 'solve/:id',
				title: 'EXERCISES',
				data: { back: (({ type = '' }) => `/bookmarks/${type}`) satisfies RouteBack },
				component: BlankPage,
			},
		],
	},
];

async function configure(): Promise<{ harness: RouterTestingHarness; header: HeaderService }> {
	TestBed.configureTestingModule({
		providers: [
			provideTestingI18n(),
			provideRouter(ROUTES),
			{ provide: TitleStrategy, useClass: TemplatePageTitleStrategy },
		],
	});

	return { harness: await RouterTestingHarness.create(), header: TestBed.inject(HeaderService) };
}

describe('TemplatePageTitleStrategy back link', () => {
	afterEach(() => {
		TestBed.resetTestingModule();
	});

	it('leaves a root without a back link', async () => {
		const { harness, header } = await configure();

		await harness.navigateByUrl('/');

		expect(header.backLink()).toBeNull();
	});

	it('takes a fixed back link as it is', async () => {
		const { harness, header } = await configure();

		await harness.navigateByUrl('/training/solve');

		expect(header.backLink()).toBe('/training');
		expect(header.titleKey()).toBe('SOLVING');
	});

	it.each([
		{
			when: 'evaluates a back function with the params of the whole branch',
			url: '/bookmarks/tactic/solve/42',
			back: '/bookmarks/tactic',
		},
		{
			when: 'falls back to the nearest ancestor that declares a back link',
			url: '/bookmarks/tactic',
			back: '/profile',
		},
		{
			when: 'updates the back link even when the route has no title',
			url: '/untitled',
			back: '/',
		},
	])('$when', async ({ url, back }) => {
		const { harness, header } = await configure();

		await harness.navigateByUrl(url);

		expect(header.backLink()).toBe(back);
	});

	it('clears the back link on the way back to a root', async () => {
		const { harness, header } = await configure();

		await harness.navigateByUrl('/training/solve');
		await harness.navigateByUrl('/');

		expect(header.backLink()).toBeNull();
	});
});
