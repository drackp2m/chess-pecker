import { I18n } from '@app/i18n';

export type ChallengeDirection = 'received' | 'sent';

export type ChallengeVerdict = 'solved' | 'recovered' | 'revealed';

export const CHALLENGE_DIRECTIONS: readonly ChallengeDirection[] = ['received', 'sent'];

export const CHALLENGE_DIRECTION_LABEL = {
	received: I18n.common.CHALLENGE_RECEIVED,
	sent: I18n.common.CHALLENGE_SENT,
} as const satisfies Record<ChallengeDirection, string>;

export const CHALLENGE_VERDICT_LABEL = {
	solved: I18n.common.CHALLENGE_VERDICT_SOLVED,
	recovered: I18n.common.CHALLENGE_VERDICT_RECOVERED,
	revealed: I18n.common.CHALLENGE_VERDICT_REVEALED,
} as const satisfies Record<ChallengeVerdict, string>;

export function toChallengeDirection(value: string | null): ChallengeDirection {
	return 'sent' === value ? 'sent' : 'received';
}
