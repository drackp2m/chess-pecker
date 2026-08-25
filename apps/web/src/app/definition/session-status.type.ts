/**
 * `unknown` is the session still being asked for; `unreachable` is the API not answering
 * at all, which is a different thing from having no session and must not be read as one.
 */
export type SessionStatus = 'anonymous' | 'authenticated' | 'unknown' | 'unreachable';

/**
 * How long the first call has taken, which is all the interface can honestly say. A cold
 * start on the free tier takes 30–50 seconds, and silence would look broken.
 */
export type ConnectionPhase = 'connecting' | 'idle' | 'unreachable' | 'waking';
