import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';

import { toFailurePhase } from '@app/use-case/sync/sync-cycle.use-case';
import { ApiCancelledError } from '@app/util/api-cancelled-error';

function answeredWith(status: number): HttpErrorResponse {
	return new HttpErrorResponse({ status, error: null });
}

describe('toFailurePhase', () => {
	it('reads a cancelled request as a pass that was cut, not refused', () => {
		expect(toFailurePhase(new ApiCancelledError('GET /sync'))).toBe('offline');
	});

	it('reads a request that never got an answer as a cut', () => {
		expect(toFailurePhase(answeredWith(0))).toBe('offline');
	});

	it('reads a timeout as a cut', () => {
		expect(toFailurePhase(answeredWith(408))).toBe('offline');
	});

	it('reads a gateway that is asleep or busy as a cut', () => {
		expect(toFailurePhase(answeredWith(502))).toBe('offline');
		expect(toFailurePhase(answeredWith(503))).toBe('offline');
		expect(toFailurePhase(answeredWith(504))).toBe('offline');
	});

	it('reads a session the server no longer honours as a refusal', () => {
		expect(toFailurePhase(answeredWith(401))).toBe('failed');
	});

	it('reads a manifest the server will not take as a refusal', () => {
		expect(toFailurePhase(answeredWith(422))).toBe('failed');
	});

	it('reads a server that answered with its own error as a refusal', () => {
		expect(toFailurePhase(answeredWith(500))).toBe('failed');
	});

	it('reads anything that is not an answer at all as a refusal', () => {
		expect(toFailurePhase(new Error('the database is closed'))).toBe('failed');
		expect(toFailurePhase(undefined)).toBe('failed');
	});
});
