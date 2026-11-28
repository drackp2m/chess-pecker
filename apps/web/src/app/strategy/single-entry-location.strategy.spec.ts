import { APP_BASE_HREF, PlatformLocation } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SingleEntryLocationStrategy } from '@app/strategy/single-entry-location.strategy';

interface At {
	readonly pathname?: string;
	readonly search?: string;
	readonly hash?: string;
}

function configure(at: At = {}) {
	const platform = {
		pathname: at.pathname ?? '/',
		search: at.search ?? '',
		hash: at.hash ?? '',
		pushState: vi.fn((_state: unknown, _title: string, _url: string) => undefined),
		replaceState: vi.fn((_state: unknown, _title: string, _url: string) => undefined),
		onPopState: vi.fn(() => () => undefined),
		onHashChange: vi.fn(() => () => undefined),
		getBaseHrefFromDOM: () => '/',
	};

	TestBed.configureTestingModule({
		providers: [
			{ provide: PlatformLocation, useValue: platform },
			{ provide: APP_BASE_HREF, useValue: '/' },
			SingleEntryLocationStrategy,
		],
	});

	return { platform, strategy: TestBed.inject(SingleEntryLocationStrategy) };
}

describe('SingleEntryLocationStrategy', () => {
	afterEach(() => {
		TestBed.resetTestingModule();
	});

	it('reads the route from the path', () => {
		const { strategy } = configure({ pathname: '/training/solve', search: '?page=2' });

		expect(strategy.path()).toBe('/training/solve?page=2');
	});

	it('writes the route into the path, without a hash', () => {
		const { platform, strategy } = configure();

		strategy.replaceState(null, '', '/training/solve', '');

		expect(platform.replaceState).toHaveBeenCalledWith(null, '', '/training/solve');
	});

	it('replaces the history entry instead of adding one', () => {
		const { platform, strategy } = configure();

		strategy.pushState(null, '', '/training', '');

		expect(platform.pushState).not.toHaveBeenCalled();
		expect(platform.replaceState).toHaveBeenCalledWith(null, '', '/training');
	});
});
