import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { API_BASE_URL } from '@app/definition/api.constant';
import { AuthUser, LoginRequest, RegisterRequest } from '@app/definition/auth.interface';

@Injectable({
	providedIn: 'root',
})
export class AuthRepository {
	private readonly httpClient = inject(HttpClient);
	private readonly baseUrl = `${API_BASE_URL}/auth`;

	async register(request: RegisterRequest): Promise<AuthUser> {
		return firstValueFrom(this.httpClient.post<AuthUser>(`${this.baseUrl}/register`, request));
	}

	async logIn(request: LoginRequest): Promise<void> {
		await firstValueFrom(this.httpClient.post(`${this.baseUrl}/login`, request));
	}

	async logOut(): Promise<void> {
		await firstValueFrom(this.httpClient.get(`${this.baseUrl}/logout`));
	}

	async refreshSession(): Promise<void> {
		await firstValueFrom(this.httpClient.get(`${this.baseUrl}/refresh-session`));
	}

	/** Who the session cookies belong to. Answers 401 when there is no session. */
	async getCurrentUser(): Promise<AuthUser> {
		return firstValueFrom(this.httpClient.get<AuthUser>(`${this.baseUrl}/me`));
	}
}
