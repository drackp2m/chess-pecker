import { HttpErrorResponse } from '@angular/common/http';

export abstract class HttpError {
	static toMessage(error: unknown, fallback: string): string {
		if (!(error instanceof HttpErrorResponse)) {
			return fallback;
		}

		if (0 === error.status) {
			return 'The server is unreachable. Check that the API is running.';
		}

		return HttpError.readDetail(error.error) ?? fallback;
	}

	static hasStatus(error: unknown, status: number): boolean {
		return error instanceof HttpErrorResponse && status === error.status;
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
