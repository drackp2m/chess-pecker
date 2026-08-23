/** A store holding user data, which logging out has to leave empty. */
export interface Resettable {
	reset(): void;
}
