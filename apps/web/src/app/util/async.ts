export class Async {
	static async within<T>(promise: Promise<T>, ms: number): Promise<T | undefined> {
		let timer: ReturnType<typeof setTimeout> | undefined;
		const late = new Promise<undefined>((resolve) => {
			timer = setTimeout(() => {
				resolve(undefined);
			}, ms);
		});

		try {
			return await Promise.race([promise, late]);
		} finally {
			clearTimeout(timer);
		}
	}

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
