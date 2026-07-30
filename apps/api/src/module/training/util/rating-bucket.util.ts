import { TrainingPolicy } from '../definition/training-policy';

/** Ancho de una franja: 600 significa de 600 a 699. */
export const ratingBucketSize = 100;

/** Baja un ELO a su centena, que es como el usuario ve siempre el nivel. */
export const toRatingBucket = (rating: number): number =>
	Math.floor(rating / ratingBucketSize) * ratingBucketSize;

/** Encierra una centena en el rango que cubre el catálogo. */
export const clampRatingBucket = (rating: number): number =>
	Math.min(TrainingPolicy.maxRating, Math.max(TrainingPolicy.minRating, toRatingBucket(rating)));

/** El techo de la franja, que siempre es el mínimo más 99. */
export const ratingBucketCeiling = (rating: number): number => rating + ratingBucketSize - 1;
