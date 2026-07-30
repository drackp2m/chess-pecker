export class Async {
	static async waitForFrames(frames = 1): Promise<void> {
		for (let i = 0; i < frames; i++) {
			await new Promise<void>((resolve) => {
				requestAnimationFrame(() => {
					resolve();
				});
			});
		}
	}
}
