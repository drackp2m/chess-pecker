export interface LoginRequest {
	username: string;
	password: string;
}

export interface RegisterRequest {
	username: string;
	password: string;
	email?: string;
}

export interface AuthUser {
	uuid: string;
	username: string;
	role: string;
	email?: string;
}
