import { TrainingPolicy } from '@app/definition/training-policy.constant';

export const RATING_BUCKET_SIZE = 100;

export const toRatingBucket = (rating: number): number =>
	Math.floor(rating / RATING_BUCKET_SIZE) * RATING_BUCKET_SIZE;

export const clampRatingBucket = (rating: number): number =>
	Math.min(TrainingPolicy.maxRating, Math.max(TrainingPolicy.minRating, toRatingBucket(rating)));

export const ratingBucketCeiling = (rating: number): number => rating + RATING_BUCKET_SIZE - 1;
