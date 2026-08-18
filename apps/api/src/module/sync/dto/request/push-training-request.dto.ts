import type { PushTrainingRequest } from '@chesspecker/api-definitions';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';

import { PushTrainingNodeDto } from './push-training-node.dto';

export class PushTrainingRequestDto implements PushTrainingRequest<Date> {
	@ValidateNested()
	@Type(() => PushTrainingNodeDto)
	training!: PushTrainingNodeDto;
}
