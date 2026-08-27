/**
 * How long a press has to be held before it counts as a long one. Shared by everything that
 * offers a second action on hold — scrubbing a chart, filing an exercise — so the gesture is
 * the same length wherever it is made.
 */
export const LONG_PRESS_MS = 400;

/** How far the finger may wander before the press is read as a scroll instead. */
export const LONG_PRESS_TOLERANCE_PX = 10;
