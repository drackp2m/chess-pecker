/**
 * ToDo => served by a mock until the API aggregates it. Every field already
 * exists on `puzzle_attempt` (`solved`, `closure`, `hint_used`, `mistake_count`),
 * so this is one `group by` away from being real: swap the mock for a repository
 * call and drop this file in favour of the shape in `@chesspecker/api-definitions`.
 */
export interface TrainingDailyBreakdown {
	readonly date: string;
	readonly solved: number;
	readonly failed: number;
	readonly resigned: number;
	readonly mistakes: number;
	readonly hints: number;
}
