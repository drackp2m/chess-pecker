import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TrainingRepository } from '@app/repository/training.repository';
import { ApiSdkService } from '@app/service/api-sdk.service';

function configure() {
	const training = vi.fn((_route: string, _options?: unknown) => Promise.resolve([]));

	TestBed.configureTestingModule({
		providers: [{ provide: ApiSdkService, useValue: { GET: { training } } }],
	});

	return { training, repository: TestBed.inject(TrainingRepository) };
}

describe('TrainingRepository, on the reads the sync pulls with', () => {
	afterEach(() => {
		TestBed.resetTestingModule();
	});

	it('lists the trainings without letting a navigation cut it', async () => {
		const { training, repository } = configure();

		await repository.list();

		expect(training).toHaveBeenCalledWith('', expect.objectContaining({ cancellable: false }));
	});

	it('pages the history without letting a navigation cut it', async () => {
		const { training, repository } = configure();

		await repository.listAttempts('training-1', { limit: 100 });

		expect(training).toHaveBeenCalledWith(
			'/:uuid/attempt',
			expect.objectContaining({ path: { uuid: 'training-1' }, cancellable: false }),
		);
	});
});
