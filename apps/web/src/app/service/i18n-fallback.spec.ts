import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Language } from '@app/definition/language.type';
import { provideI18n } from '@app/i18n';

const SOURCE_FILE = 'i18n/es-ES.json';
const FRENCH_FILE = 'i18n/fr-FR.json';
const SOURCE_SCOPE_FILE = 'i18n/training/es-ES.json';
const FRENCH_SCOPE_FILE = 'i18n/training/fr-FR.json';

const GREETING = 'GREETING';
const CYCLE = 'CYCLE';

type Catalogue = Record<string, string>;

interface Harness {
	transloco: TranslocoService;
	httpMock: HttpTestingController;
}

function setUp(language: Language): Harness {
	TestBed.configureTestingModule({
		providers: [provideHttpClient(), provideHttpClientTesting(), provideI18n()],
	});

	const transloco = TestBed.inject(TranslocoService);

	transloco.setActiveLang(language);

	return { transloco, httpMock: TestBed.inject(HttpTestingController) };
}

function settle(): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(() => {
			resolve();
		}, 0);
	});
}

async function loadFrench(harness: Harness, french: Catalogue, source: Catalogue): Promise<void> {
	const loaded = firstValueFrom(harness.transloco.load('fr-FR'));

	harness.httpMock.expectOne(FRENCH_FILE).flush(french);
	harness.httpMock.expectOne(SOURCE_FILE).flush(source);

	await loaded;
}

describe('i18n fallback', () => {
	afterEach(() => {
		try {
			TestBed.inject(HttpTestingController).verify();
		} finally {
			TestBed.resetTestingModule();
			vi.restoreAllMocks();
		}
	});

	it('reads the source language when the active one leaves the key empty', async () => {
		const harness = setUp('fr-FR');

		await loadFrench(harness, { [GREETING]: '' }, { [GREETING]: 'Hola' });

		expect(harness.transloco.translate(GREETING)).toBe('Hola');
	});

	it('reads the source language when the key never reached the active one', async () => {
		const harness = setUp('fr-FR');

		await loadFrench(harness, {}, { [GREETING]: 'Hola' });

		expect(harness.transloco.translate(GREETING)).toBe('Hola');
	});

	it('keeps the active language when the key is translated', async () => {
		const harness = setUp('fr-FR');

		await loadFrench(harness, { [GREETING]: 'Bonjour' }, { [GREETING]: 'Hola' });

		expect(harness.transloco.translate(GREETING)).toBe('Bonjour');
	});

	it('fills the params of the value it fell back to', async () => {
		const harness = setUp('fr-FR');

		await loadFrench(harness, { [CYCLE]: '' }, { [CYCLE]: 'Ciclo {{ index }}' });

		expect(harness.transloco.translate(CYCLE, { index: 3 })).toBe('Ciclo 3');
	});

	it('gives the key back when neither language carries it', async () => {
		vi.spyOn(console, 'warn').mockImplementation(() => undefined);

		const harness = setUp('fr-FR');

		await loadFrench(harness, {}, {});

		expect(harness.transloco.translate(GREETING)).toBe(GREETING);
	});

	it('reaches the source language through a scope too', async () => {
		const { transloco, httpMock } = setUp('fr-FR');
		const loaded = firstValueFrom(transloco.load('training/fr-FR'));

		httpMock.expectOne(FRENCH_SCOPE_FILE).flush({ [GREETING]: '' });
		httpMock.expectOne(SOURCE_SCOPE_FILE).flush({ [GREETING]: 'Hola' });

		await loaded;

		expect(transloco.translate(`training.${GREETING}`)).toBe('Hola');
	});

	it('asks for a scope file once when the active language is already the source', async () => {
		const { transloco, httpMock } = setUp('es-ES');
		const loaded = firstValueFrom(transloco.load('training/es-ES'));
		const requests = httpMock.match(SOURCE_SCOPE_FILE);

		expect(requests).toHaveLength(1);

		requests[0]?.flush({ [GREETING]: 'Hola' });

		await loaded;

		expect(transloco.translate(`training.${GREETING}`)).toBe('Hola');
	});

	it('keeps a failed fetch retryable instead of serving the failure back', async () => {
		const { transloco, httpMock } = setUp('es-ES');
		const loaded = firstValueFrom(transloco.load('es-ES'));

		httpMock.expectOne(SOURCE_FILE).flush(null, { status: 500, statusText: 'Server Error' });

		await settle();

		httpMock.expectOne(SOURCE_FILE).flush({ [GREETING]: 'Hola' });

		await loaded;

		expect(transloco.translate(GREETING)).toBe('Hola');
	});

	it('asks for nothing besides itself when the source language is the active one', async () => {
		const { transloco, httpMock } = setUp('es-ES');
		const loaded = firstValueFrom(transloco.load('es-ES'));
		const requests = httpMock.match(SOURCE_FILE);

		expect(requests).toHaveLength(1);

		requests[0]?.flush({ [GREETING]: 'Hola' });

		await loaded;

		expect(transloco.translate(GREETING)).toBe('Hola');
	});
});
