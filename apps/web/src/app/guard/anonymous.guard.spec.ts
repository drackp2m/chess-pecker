import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
	ActivatedRouteSnapshot,
	GuardResult,
	Router,
	RouterStateSnapshot,
	UrlTree,
	provideRouter,
} from '@angular/router';
import { afterEach, describe, expect, it } from 'vitest';

import { SessionStatus } from '@app/definition/session-status.type';
import { anonymousGuard } from '@app/guard/anonymous.guard';
import { SessionStore } from '@app/store/session.store';

function configure(initial: SessionStatus) {
	const status = signal<SessionStatus>(initial);

	TestBed.configureTestingModule({
		providers: [provideRouter([]), { provide: SessionStore, useValue: { status } }],
	});

	return status;
}

function guard(): Promise<GuardResult> {
	const result = TestBed.runInInjectionContext(() =>
		anonymousGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
	);

	TestBed.tick();

	return Promise.resolve(result as GuardResult | Promise<GuardResult>);
}

function urlOf(result: GuardResult): string | undefined {
	return result instanceof UrlTree ? TestBed.inject(Router).serializeUrl(result) : undefined;
}

describe('anonymousGuard', () => {
	afterEach(() => {
		TestBed.resetTestingModule();
	});

	it('sends someone already signed in home instead of to the form', async () => {
		configure('authenticated');

		expect(urlOf(await guard())).toBe('/');
	});

	it('lets a visitor without a session through', async () => {
		configure('anonymous');

		expect(await guard()).toBe(true);
	});

	it('waits for the session probe before deciding', async () => {
		const status = configure('unknown');
		const deciding = guard();

		status.set('authenticated');
		TestBed.tick();

		expect(urlOf(await deciding)).toBe('/');
	});
});
