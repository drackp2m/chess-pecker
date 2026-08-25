/**
 * The syncable model this server runs, bumped by hand. The client compares it before pushing,
 * which is the cheapest guard against a PWA-cached client writing history on an old model.
 */
export const SYNC_SCHEMA_VERSION = 1;
