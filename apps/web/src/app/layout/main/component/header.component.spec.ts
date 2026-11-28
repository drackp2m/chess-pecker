import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ConnectionIndicatorComponent } from '@app/component/connection-indicator/connection-indicator.component';
import { SyncIndicatorComponent } from '@app/component/sync-indicator/sync-indicator.component';
import type { ConnectionPhase } from '@app/definition/session-status.type';
import { I18n } from '@app/i18n';
import { HeaderComponent } from '@app/layout/main/component/header.component';
import { HeaderService } from '@app/service/header.service';
import { SessionStore } from '@app/store/session.store';
import { provideTestingI18n } from '@app/testing/i18n.harness';

@Component({ selector: 'app-sync-indicator', template: '' })
class SyncIndicatorStubComponent {}

@Component({ selector: 'app-connection-indicator', template: '' })
class ConnectionIndicatorStubComponent {}

function configure(phase: ConnectionPhase = 'idle') {
	const router = { navigateByUrl: vi.fn(() => Promise.resolve(true)) };

	TestBed.configureTestingModule({
		imports: [HeaderComponent],
		providers: [
			provideTestingI18n(),
			{ provide: Router, useValue: router },
			{ provide: SessionStore, useValue: { connectionPhase: signal(phase) } },
		],
	});

	TestBed.overrideComponent(HeaderComponent, {
		remove: { imports: [SyncIndicatorComponent, ConnectionIndicatorComponent] },
		add: { imports: [SyncIndicatorStubComponent, ConnectionIndicatorStubComponent] },
	});

	const header = TestBed.inject(HeaderService);
	const fixture = TestBed.createComponent(HeaderComponent);

	return { router, header, fixture };
}

function render(fixture: ComponentFixture<HeaderComponent>): HTMLElement {
	fixture.detectChanges();

	return fixture.nativeElement as HTMLElement;
}

describe('HeaderComponent', () => {
	afterEach(() => {
		TestBed.resetTestingModule();
	});

	it('shows no back button on a root', () => {
		const { fixture } = configure();

		expect(render(fixture).querySelector('.back')).toBeNull();
	});

	it('goes to the back link through the router', () => {
		const { router, header, fixture } = configure();

		header.setBackLink('/profile/challenges/received');
		render(fixture).querySelector<HTMLButtonElement>('.back')?.click();

		expect(router.navigateByUrl).toHaveBeenCalledWith('/profile/challenges/received');
	});

	it('follows the back link when it changes on the same header', () => {
		const { router, header, fixture } = configure();

		header.setBackLink('/profile/bookmarks/tactic');
		render(fixture);
		header.setBackLink('/profile/challenges/sent');
		render(fixture).querySelector<HTMLButtonElement>('.back')?.click();

		expect(router.navigateByUrl).toHaveBeenCalledWith('/profile/challenges/sent');
	});

	it('labels the back button for assistive technology', () => {
		const { header, fixture } = configure();

		header.setBackLink('/');

		expect(render(fixture).querySelector('.back')?.getAttribute('aria-label')).toBe(
			I18n.common.BACK,
		);
	});

	it('names the app when the route brings no title', () => {
		const { fixture } = configure();

		expect(render(fixture).querySelector('.title')?.textContent).toContain('Chess Pecker');
	});

	it('shows the title of the route', () => {
		const { header, fixture } = configure();

		header.setTitleKey(I18n.common.TRAINING);

		expect(render(fixture).querySelector('.title')?.textContent).toContain(I18n.common.TRAINING);
	});

	it('warns about the connection while the server cannot be reached', () => {
		const { fixture } = configure('unreachable');

		expect(render(fixture).querySelector('app-connection-indicator')).not.toBeNull();
	});
});
