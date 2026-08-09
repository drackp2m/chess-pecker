import { HttpErrorResponse } from '@angular/common/http';

import type { TranslationRef } from '@app/definition/i18n.type';
import { I18n, i18nRef } from '@app/i18n';

export const API_FAILURE = {
	emptyCatalog: 'rating/not enough puzzles',
	staleTrainingList: 'training/already in progress',
	missingGoal: 'goal/goal is required',
} as const;

const FAILURE_KEYS: Readonly<Record<string, string>> = {
	[API_FAILURE.emptyCatalog]: I18n.common.CATALOG_EMPTY,
	[API_FAILURE.staleTrainingList]: I18n.common.TRAINING_ALREADY_RUNNING,
	[API_FAILURE.missingGoal]: I18n.common.GOAL_REQUIRED,
};

export abstract class HttpError {
	static toRef(error: unknown, fallback: TranslationRef): TranslationRef {
		if (!(error instanceof HttpErrorResponse)) {
			return fallback;
		}

		if (0 === error.status) {
			return i18nRef(I18n.common.SERVER_UNREACHABLE);
		}

		const failure = HttpError.toFailure(error);
		const key = undefined === failure ? undefined : FAILURE_KEYS[failure];

		if (undefined !== key) {
			return { key };
		}

		const detail = HttpError.readDetail(error.error);

		return undefined === detail ? fallback : i18nRef(I18n.common.SERVER_DETAIL, { detail });
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
