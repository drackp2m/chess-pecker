export interface LocalRecord {
	readonly createdAt: Date;
	readonly updatedAt: Date;
	/** The uuid it was born with here. Immutable, and the push's retry key. */
	readonly clientRef?: string;
	/** It exists on the server. This seals the copy without modifying it: `updatedAt` stands. */
	readonly syncedAt?: Date;
	/** It has unpushed changes: set on the first write, cleared once confirmed. */
	readonly pendingSince?: Date;
	/** The server refused it and it will not be retried. It is shown, not deleted. */
	readonly rejectedAt?: Date;
	readonly rejectedReason?: string;
}
