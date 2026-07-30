import { Injectable } from '@nestjs/common';

import { ForbiddenException } from '../../../shared/exception/forbidden.exception';
import { PreconditionFailedException } from '../../../shared/exception/precondition-failed.exception';
import { PuzzleAttemptKind } from '../definition/puzzle-attempt-kind.enum';
import { TrainingCycleStatus } from '../definition/training-cycle-status.enum';
import { TrainingFinishedReason } from '../definition/training-finished-reason.enum';
import { TrainingPolicy } from '../definition/training-policy';
import { SubmitCycleAttemptRequestDto } from '../dto/request/submit-cycle-attempt-request.dto';
import { PuzzleAttempt } from '../puzzle-attempt.entity';
import { PuzzleAttemptRepository } from '../puzzle-attempt.repository';
import { TrainingCycleItem } from '../training-cycle-item.entity';
import { TrainingCycleItemRepository } from '../training-cycle-item.repository';
import { TrainingCycle } from '../training-cycle.entity';
import { TrainingCycleRepository } from '../training-cycle.repository';
import { Training } from '../training.entity';
import { TrainingRepository } from '../training.repository';

import { ApplySyncTimestampsUseCase } from './apply-sync-timestamps.use-case';

@Injectable()
export class SubmitCycleAttemptUseCase {
	constructor(
		private readonly puzzleAttemptRepository: PuzzleAttemptRepository,
		private readonly trainingCycleItemRepository: TrainingCycleItemRepository,
		private readonly trainingCycleRepository: TrainingCycleRepository,
		private readonly trainingRepository: TrainingRepository,
		private readonly applySyncTimestampsUseCase: ApplySyncTimestampsUseCase,
	) {}

	async execute(
		training: Training,
		submitRequest: SubmitCycleAttemptRequestDto,
	): Promise<{ attempt: PuzzleAttempt; cycleFinished: boolean }> {
		const item = await this.resolveOpenItem(training, submitRequest.cycleItemUuid);

		const attempt = this.applySyncTimestampsUseCase.execute(
			new PuzzleAttempt({
				training,
				kind: PuzzleAttemptKind.Cycle,
				cycleItem: item,
				puzzle: item.trainingPuzzle.puzzle,
				durationMs: submitRequest.durationMs,
				solved: submitRequest.solved,
			}),
			submitRequest,
		);

		await this.puzzleAttemptRepository.insert(attempt);

		const total = await this.trainingCycleItemRepository.countByCycle(item.cycle.uuid);
		const attempts = await this.puzzleAttemptRepository.getManyByCycle(item.cycle.uuid);

		if (attempts.length < total) {
			return { attempt, cycleFinished: false };
		}

		await this.closeCycle(training, item.cycle, attempt);

		return { attempt, cycleFinished: true };
	}

	/** El ejercicio que se está intentando, si es de este entrenamiento y aún admite intento. */
	private async resolveOpenItem(
		training: Training,
		cycleItemUuid: string,
	): Promise<TrainingCycleItem> {
		const item = await this.trainingCycleItemRepository.getOne(
			{ uuid: cycleItemUuid },
			{ populate: ['cycle', 'trainingPuzzle.puzzle'] },
		);

		if (item.cycle.training.uuid !== training.uuid) {
			throw new ForbiddenException('not allowed', 'cycle');
		}

		if (TrainingCycleStatus.Running !== item.cycle.status) {
			throw new PreconditionFailedException('cycle is closed', 'cycle');
		}

		// Un ejercicio se resuelve o se falla, una sola vez: no hay reintento, porque volver a
		// intentarlo ya no mide reconocimiento de patrón.
		const existing = await this.puzzleAttemptRepository.getMany({ cycleItem: item.uuid });

		if (0 < existing.length) {
			throw new PreconditionFailedException('already attempted', 'cycleItem');
		}

		return item;
	}

	private async closeCycle(
		training: Training,
		cycle: TrainingCycle,
		attempt: PuzzleAttempt,
	): Promise<void> {
		await this.trainingCycleRepository.updateStatus(cycle.uuid, TrainingCycleStatus.Finished);

		// El tope de ciclos sí cierra el entrenamiento solo; el resto de finales los decide el
		// usuario con lo que le enseña la pantalla de progreso.
		if (TrainingPolicy.maxCycles <= cycle.index) {
			await this.trainingRepository.finish(
				training.uuid,
				TrainingFinishedReason.MaxCycles,
				attempt.updatedAt,
			);
		}
	}
}
