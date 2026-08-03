import { HttpErrorResponse } from '@angular/common/http';

export const API_FAILURE = {
	emptyCatalog: 'rating/not enough puzzles',
	staleTrainingList: 'training/already in progress',
	missingGoal: 'goal/goal is required',
} as const;

const FAILURE_MESSAGES: Readonly<Record<string, string>> = {
	[API_FAILURE.emptyCatalog]:
		'The catalog has no exercises in that rating band, so there is nothing to deal. An administrator has to import more puzzles.',
	[API_FAILURE.staleTrainingList]:
		'You already have a training in progress. The list has just been reloaded — carry on with that one, or cancel it first.',
	[API_FAILURE.missingGoal]:
		'Set how many exercises a day you are aiming for before opening the first cycle.',
};

export abstract class HttpError {
	static toMessage(error: unknown, fallback: string): string {
		if (!(error instanceof HttpErrorResponse)) {
			return fallback;
		}

		if (0 === error.status) {
			return 'The server is unreachable. Check that the API is running.';
		}

		const failure = HttpError.toFailure(error);

		return (
			(undefined === failure ? undefined : FAILURE_MESSAGES[failure]) ??
			HttpError.readDetail(error.error) ??
			fallback
		);
	}

	static hasStatus(error: unknown, status: number): boolean {
		return error instanceof HttpErrorResponse && status === error.status;
	}

	static toFailure(error: unknown): string | undefined {
		if (!(error instanceof HttpErrorResponse)) {
			return undefined;
		}

		return HttpError.toFailureKey(HttpError.readBody(error.error));
	}

	private static readBody(body: unknown): unknown {
		if (null === body || 'object' !== typeof body) {
			return undefined;
		}

		return (body as { message?: unknown }).message;
	}

	private static toFailureKey(message: unknown): string | undefined {
		if (null === message || 'object' !== typeof message) {
			return undefined;
		}

		const entries = Object.entries(message as Record<string, unknown>);
		const entry = entries.at(0);

		if (1 !== entries.length || undefined === entry) {
			return undefined;
		}

		const [origin, detail] = entry;

		return 'string' === typeof detail ? `${origin}/${detail}` : undefined;
	}

	private static readDetail(body: unknown): string | undefined {
		if ('string' === typeof body) {
			return '' === body ? undefined : body;
		}

		if (null === body || 'object' !== typeof body) {
			return undefined;
		}

		return HttpError.readMessage((body as { message?: unknown }).message);
	}

	private static readMessage(message: unknown): string | undefined {
		if ('string' === typeof message) {
			return message;
		}

		if (Array.isArray(message)) {
			return HttpError.join(message.map((entry: unknown) => String(entry)));
		}

		if (null !== message && 'object' === typeof message) {
			return HttpError.join(
				Object.entries(message as Record<string, unknown>).map(
					([field, detail]) => `${field} ${String(detail)}`,
				),
			);
		}

		return undefined;
	}

	private static join(details: string[]): string | undefined {
		const sentences = details.filter((detail) => '' !== detail.trim());

		return 0 === sentences.length ? undefined : `${sentences.join('. ')}.`;
	}
}
