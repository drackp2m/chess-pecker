/**
 * The method's decisions that are app policy and not schema, together here so changing one
 * means touching a file rather than migrating rows.
 */
export const TrainingPolicy = {
	/** The catalogue's ELO range, in closed hundreds. */
	minRating: 400,
	maxRating: 2500,

	/** Opening scans: single exercises, narrowing the region before spending rounds of ten. */
	scanRounds: 4,
	scanStartRating: 1200,
	/** The first scan's jump, halved on each one after it. */
	scanInitialStep: 600,

	/** Exercises per refine round. */
	refinePuzzles: 10,
	/** Above this success rate the level is too easy; below it, too hard. */
	refineUpperAccuracy: 0.9,
	refineLowerAccuracy: 0.8,

	/** Size of the working set, and the width of the ELO band it is drawn from. */
	defaultSetSize: 1000,
	setRatingSpread: 100,

	/** The block shuffled within between cycles, keeping the easy → hard order. */
	shuffleBlockSize: 100,

	minCycles: 4,
	maxCycles: 7,

	/**
	 * What each cycle demands of cycle 1's real time. Index 0 is cycle 2, and the last factor
	 * holds from there on.
	 */
	cycleTargetFactors: [0.5, 0.35, 0.25],

	/** Below this improvement between cycles, carrying on no longer pays. */
	plateauImprovement: 0.1,

	/** The activity breakdown's widest window, and the one served when none is asked for. */
	activityMaxDays: 53 * 7,

	/**
	 * Attempts per history page. The whole game travels inside each, so a page is measured in
	 * rows and not days: a 1000-exercise cycle is four trips, not one huge one.
	 */
	attemptPageSize: 250,
} as const;
