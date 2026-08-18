import type { SyncEntity } from '@chesspecker/api-definitions';

import { I18n } from '@app/i18n';

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

export const SYNC_ENTITY_LABEL = {
	training: I18n.setting.SYNC_ENTITY_TRAINING,
	trainingGoal: I18n.setting.SYNC_ENTITY_GOAL,
	calibrationRound: I18n.setting.SYNC_ENTITY_CALIBRATION_ROUND,
	calibrationPuzzle: I18n.setting.SYNC_ENTITY_CALIBRATION_PUZZLE,
	trainingPuzzle: I18n.setting.SYNC_ENTITY_TRAINING_PUZZLE,
	cycle: I18n.setting.SYNC_ENTITY_CYCLE,
	cycleItem: I18n.setting.SYNC_ENTITY_CYCLE_ITEM,
	attempt: I18n.setting.SYNC_ENTITY_ATTEMPT,
} as const satisfies Record<SyncEntity, string>;
