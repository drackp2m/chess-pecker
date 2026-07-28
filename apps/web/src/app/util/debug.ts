/**
 * Debug logging gated by the `APP_DEBUG` build-time constant (see `define`
 * in `angular.json`): on under `ng serve`, off in production and test builds.
 */
export abstract class Debug {
	static log(...args: unknown[]): void {
		if ('undefined' !== typeof APP_DEBUG && APP_DEBUG) {
			console.log(...args);
		}
	}
}
