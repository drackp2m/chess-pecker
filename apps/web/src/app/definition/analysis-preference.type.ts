export const ANALYSIS_DEPTHS = [10, 12, 14, 16, 18, 20, 22] as const;

export type AnalysisDepth = (typeof ANALYSIS_DEPTHS)[number];

export const DEFAULT_ANALYSIS_DEPTH: AnalysisDepth = 16;

export const DEFAULT_ANALYSIS_BAR = true;

export function normalizeAnalysisDepth(value: unknown): AnalysisDepth {
	return ANALYSIS_DEPTHS.find((depth) => depth === value) ?? DEFAULT_ANALYSIS_DEPTH;
}

export function normalizeAnalysisBar(value: unknown): boolean {
	return 'boolean' === typeof value ? value : DEFAULT_ANALYSIS_BAR;
}
