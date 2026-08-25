export const TrainingPolicy = {
	minRating: 400,
	maxRating: 2500,

	explorationRounds: 4,
	explorationStartRating: 1200,
	explorationInitialStep: 600,

	refinePuzzles: 10,
	refineUpperAccuracy: 0.9,
	refineLowerAccuracy: 0.8,
	maxRefineRounds: 6,

	defaultSetSize: 1000,
	setRatingSpread: 100,

	shuffleBlockSize: 100,

	minCycles: 4,
	maxCycles: 7,

	cycleTargetFactors: [0.5, 0.35, 0.25],

	plateauImprovement: 0.1,
} as const;
