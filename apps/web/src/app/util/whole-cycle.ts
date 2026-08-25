import {
	CycleItemRow,
	TrainingCycleRow,
} from '@app/repository/definition/training-schema.interface';

export function isWholeCycle(cycle: TrainingCycleRow, items: readonly CycleItemRow[]): boolean {
	return undefined !== cycle.expectedItems && cycle.expectedItems <= items.length;
}
