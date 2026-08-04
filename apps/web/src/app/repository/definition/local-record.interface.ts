export interface LocalRecord {
	readonly createdAt: Date;
	readonly updatedAt: Date;
	readonly syncedAt?: Date;
}
