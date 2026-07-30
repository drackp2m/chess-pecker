import { SettingSchema } from '@app/repository/definition/setting-schema.interface';

// ToDo => settings are the only thing this app persists. Everything the Woodpecker
// method and the comparison screens are built on has nowhere to live yet:
//
//   puzzle      the imported exercises, keyed by their Lichess id, so a set survives
//               a reload and the same row can be reused across sets
//   puzzleSet   a named, fixed selection: the unit a Woodpecker cycle runs over
//   cycle       one pass over a set — its order, start date, and completion
//   attempt     one solve: setId, cycleId, puzzleId, startedAt, durationMs,
//               wasFirstTryCorrect, movesPlayed. Index by (puzzleId, cycleId) for
//               "how did I do last time" and by cycleId for the per-cycle total
//
// Two things worth deciding before the first migration, because they are painful
// afterwards: give every row a `syncedAt`/`dirty` marker so a backend can pull deltas
// instead of the whole table, and use a client-generated uuid as the primary key so
// rows created offline keep their identity once the server sees them. Both are cheap
// now and a data migration later.
export type AppSchema = SettingSchema;
