/**
 * `unknown` is the session still being asked for; `unreachable` is the API not answering
 * at all, which is a different thing from having no session and must not be read as one.
 */
export type SessionStatus = 'anonymous' | 'authenticated' | 'unknown' | 'unreachable';

/**
 * How long the first call has been taking, which is all the interface can honestly say
 * while it waits. A cold start on the free hosting tier takes 30–50 seconds, so staying
 * silent would look like a broken application.
 */
export type ConnectionPhase = 'connecting' | 'idle' | 'unreachable' | 'waking';
