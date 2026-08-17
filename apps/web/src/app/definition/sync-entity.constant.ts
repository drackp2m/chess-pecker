import type { SyncEntity } from '@chesspecker/api-definitions';

/**
 * Las ocho tablas del entrenamiento, que se llaman igual aquí y en el servidor, en el orden
 * topológico en el que suben: un hijo necesita el uuid definitivo de su padre.
 */
export const SYNC_ENTITIES: readonly SyncEntity[] = [
	'training',
	'trainingGoal',
	'calibrationRound',
	'calibrationPuzzle',
	'trainingPuzzle',
	'cycle',
	'cycleItem',
	'attempt',
];

export const TREE_SYNC_ENTITIES: readonly SyncEntity[] = SYNC_ENTITIES.filter(
	(entity) => 'attempt' !== entity,
);
