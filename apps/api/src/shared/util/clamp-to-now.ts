import { GenerateNowDateUseCase } from '../use-case/generate-now-date.use-case';

export function clampToNow(updatedAt?: Date): Date {
	const now = new GenerateNowDateUseCase().execute();

	return undefined === updatedAt || updatedAt > now ? now : updatedAt;
}
