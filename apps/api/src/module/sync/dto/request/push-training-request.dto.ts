import type { PushTrainingRequest } from '@chesspecker/api-definitions';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';

import { PushTrainingNodeDto } from './push-training-node.dto';

/**
 * El árbol entero de un entrenamiento, que es la unidad de subida: un hijo necesita el uuid
 * definitivo de su padre, así que mandarlos por separado obligaría a coordinar el orden
 * desde fuera.
 */
export class PushTrainingRequestDto implements PushTrainingRequest<Date> {
	@ValidateNested()
	@Type(() => PushTrainingNodeDto)
	training!: PushTrainingNodeDto;
}
