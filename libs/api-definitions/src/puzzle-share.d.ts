import { PuzzleAttemptClosure } from './training';
import { UserSummary } from './user';

/**
 * What somebody made of a shared exercise. The same shape for whoever solved it, sender
 * included: putting these side by side is the whole point of sharing one.
 */
export interface PuzzleShareResult {
	readonly uuid: string;
	readonly solved: boolean;
	readonly closure: PuzzleAttemptClosure;
	readonly hintUsed: boolean;
	readonly mistakeCount: number;
	/**
	 * Missing when the exercise was solved on a board with no clock: only a training times
	 * an attempt, and a challenge can be answered from anywhere.
	 */
	readonly durationMs?: number;
	readonly createdAt: string;
}

/** Somebody the challenge involves, and what they made of it once they have answered. */
export interface PuzzleShareParticipant {
	readonly user: UserSummary;
	readonly result: PuzzleShareResult | null;
}

/**
 * One exercise handed to one or more friends. The sender is a participant like any other,
 * so a challenge of three people is read as three rows and not as one plus two.
 */
export interface PuzzleShare {
	readonly uuid: string;
	/** The exercise as the front names it, the reference a bookmark already travels under. */
	readonly lichessId: string;
	readonly message: string | null;
	readonly sender: PuzzleShareParticipant;
	readonly recipients: readonly PuzzleShareParticipant[];
	readonly createdAt: string;
}

/**
 * The numbers a solve reports. They come from the device, like every other attempt does:
 * this is a game between friends and not a ranking.
 */
export interface PuzzleShareResultRequest {
	solved: boolean;
	closure: PuzzleAttemptClosure;
	hintUsed: boolean;
	mistakeCount: number;
	durationMs?: number;
}

export interface CreatePuzzleShareRequest {
	lichessId: string;
	/** Everyone it goes to at once: each one gets a row of their own, and a notification. */
	recipientUuids: string[];
	message?: string;
	/**
	 * The training attempt the challenge came out of, when the board that sent it was
	 * recording one. It is a pointer and not the numbers: those travel in `result`.
	 */
	attemptUuid?: string;
	/** How the sender did, so the comparison has something on it from the first moment. */
	result?: PuzzleShareResultRequest;
}
