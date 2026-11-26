export const CycleDifficulty = {
	tierSize: 100,
	jitter: 15,

	varietyWindow: 8,
	varietyMemory: [3, 2, 1],
	ignoredThemes: ['advantage', 'crushing', 'equality', 'master', 'masterVsMaster', 'superGM'],

	bookmark: {
		favorite: 0,
		easy: -60,
		hard: 60,
		unclear: 90,
	},

	history: {
		failed: 50,
		hintUsed: 30,
		perMistake: 10,
		maxMistakes: 30,
		maxSlowness: 30,
		fastRatio: 0.5,
		fastAndClean: -30,
	},

	structure: {
		perExtraMove: 10,
		quietStart: 20,
		materialBase: 6,
		perExtraPiece: 2,
		maxMaterial: 10,
	},
} as const;
