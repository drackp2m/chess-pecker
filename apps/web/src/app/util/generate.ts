export abstract class Generate {
	static randomNumber(min = 0, max = 100): number {
		const array = new Uint32Array(1);
		window.crypto.getRandomValues(array);
		const random = array[0];

		if (undefined === random) {
			return NaN;
		}

		const randomNumber = Math.floor((random / (0xffffffff + 1)) * (max - min + 1)) + min;

		return randomNumber;
	}
}
