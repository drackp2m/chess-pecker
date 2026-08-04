export class ApiCancelledError extends Error {
	constructor(request: string) {
		super(`The request was cancelled before it answered: ${request}`);

		this.name = 'ApiCancelledError';
	}

	static is(error: unknown): boolean {
		return error instanceof ApiCancelledError;
	}
}
