import { I18n } from '@app/i18n';

/**
 * Where the sync cycle stands. The last three are all equally final: `failed` and `offline`
 * open the boot gate like `ready`, since "until it ends" has to mean until it ends.
 */
export type SyncPhase =
	'checking' | 'failed' | 'idle' | 'offline' | 'pulling' | 'pushing' | 'ready';

/** The three endings: the pass is no longer running. */
export function isSettledPhase(phase: SyncPhase): boolean {
	return 'ready' === phase || 'failed' === phase || 'offline' === phase;
}

export const SYNC_PHASE_LABEL = {
	idle: I18n.common.LOADING,
	checking: I18n.common.SYNC_CHECKING,
	pushing: I18n.common.SYNC_PUSHING,
	pulling: I18n.common.SYNC_PULLING,
	ready: I18n.common.LOADING,
	failed: I18n.common.SYNC_FAILED,
	offline: I18n.common.SYNC_OFFLINE,
} as const satisfies Record<SyncPhase, string>;
