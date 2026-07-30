import { JwtAlgorithm } from '../../../environment/jwt-algorithm.type';

export interface JwtConfig {
	algorithm: JwtAlgorithm;
	secret: string;
	issuer: string;
	audience: string;
	id: string;
	accessTokenExpiresIn: string;
	refreshTokenExpiresIn: string;
}
