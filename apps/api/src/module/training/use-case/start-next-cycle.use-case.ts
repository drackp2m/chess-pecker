import { Injectable } from '@nestjs/common';

import { PreconditionFailedException } from '../../../shared/exception/precondition-failed.exception';
import { TrainingCycleStatus } from '../definition/training-cycle-status.enum';
import { TrainingPolicy } from '../definition/training-policy';
import { TrainingStatus } from '../definition/training-status.enum';
import { TrainingCycleItem } from '../training-cycle-item.entity';
import { TrainingCycleItemRepository } from '../training-cycle-item.repository';
import { TrainingCycle } from '../training-cycle.entity';
import { TrainingCycleRepository } from '../training-cycle.repository';
import { TrainingGoalRepository } from '../training-goal.repository';
import { TrainingPuzzle } from '../training-puzzle.entity';
import { TrainingPuzzleRepository } from '../training-puzzle.repository';
import { Training } from '../training.entity';
import { TrainingRepository } from '../training.repository';

@Injectable()
export class StartNextCycleUseCase {
	constructor(
		private readonly trainingCycleRepository: TrainingCycleRepository,
		private readonly trainingCycleItemRepository: TrainingCycleItemRepository,
		private readonly trainingPuzzleRepository: TrainingPuzzleRepository,
		private readonly trainingGoalRepository: TrainingGoalRepository,
		private readonly trainingRepository: TrainingRepository,
	) {}

	async execute(training: Training): Promise<TrainingCycle> {
		const cycles = await this.assertCanStart(training);

		const trainingPuzzles = await this.trainingPuzzleRepository.getManyByTraining(training.uuid);

		if (0 === trainingPuzzles.length) {
			throw new PreconditionFailedException('set is empty', 'set');
		}

		const cycle = await this.trainingCycleRepository.insert(
			new TrainingCycle({ training, index: cycles.length + 1 }),
		);

		const items = StartNextCycleUseCase.buildOrder(trainingPuzzles).map(
			(trainingPuzzle, position) => new TrainingCycleItem({ cycle, trainingPuzzle, position }),
		);

		await this.trainingCycleItemRepository.insertMany(items);

		if (TrainingStatus.Running !== training.status) {
			await this.trainingRepository.updateStatus(training.uuid, TrainingStatus.Running);
		}

		return cycle;
	}

	/**
	 * Orden de la pasada: bloques de ELO cercano en orden ascendente, barajados por dentro.
	 *
	 * Mantener el orden de los bloques conserva la progresión fácil → difícil; barajar dentro
	 * evita que el usuario se aprenda la secuencia de una pasada a la siguiente. Y como los
	 * temas quedan mezclados, tampoco puede adivinar la solución por el contexto temático.
	 */
	private static buildOrder(trainingPuzzles: TrainingPuzzle[]): TrainingPuzzle[] {
		const blocks = new Map<number, TrainingPuzzle[]>();

		for (const trainingPuzzle of trainingPuzzles) {
			const block =
				Math.floor(trainingPuzzle.puzzle.rating / TrainingPolicy.shuffleBlockSize) *
				TrainingPolicy.shuffleBlockSize;

			blocks.set(block, [...(blocks.get(block) ?? []), trainingPuzzle]);
		}

		return [...blocks.keys()]
			.sort((one, other) => one - other)
			.flatMap((block) => shuffle(blocks.get(block) ?? []));
	}

	/** Todo lo que impide abrir una pasada nueva; devuelve las que ya hay si no impide nada. */
	private async assertCanStart(training: Training): Promise<TrainingCycle[]> {
		if (![TrainingStatus.Planning, TrainingStatus.Running].includes(training.status)) {
			throw new PreconditionFailedException('not ready for cycles', 'training');
		}

		const cycles = await this.trainingCycleRepository.getManyByTraining(training.uuid);

		if (cycles.some((cycle) => TrainingCycleStatus.Running === cycle.status)) {
			throw new PreconditionFailedException('cycle in progress', 'cycle');
		}

		if (TrainingPolicy.maxCycles <= cycles.length) {
			throw new PreconditionFailedException('max cycles reached', 'cycle');
		}

		// El ritmo del ciclo 1 lo fija el usuario y de él sale todo lo demás, así que sin
		// objetivo no se arranca.
		if (0 === cycles.length) {
			const goal = await this.trainingGoalRepository.getCurrentByTraining(training.uuid);

			if (undefined === goal) {
				throw new PreconditionFailedException('goal is required', 'goal');
			}
		}

		return cycles;
	}
}

const shuffle = <T>(items: T[]): T[] => {
	const shuffled = [...items];

	for (let index = shuffled.length - 1; 0 < index; index--) {
		const target = Math.floor(Math.random() * (index + 1));

		[shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
	}

	return shuffled;
};
