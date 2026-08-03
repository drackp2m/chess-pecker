import { Injectable, inject } from '@angular/core';
import type { AuthUser, LoginRequest, RegisterRequest } from '@chesspecker/api-definitions';

import { ApiSdkService } from '@app/service/api-sdk.service';

@Injectable({
	providedIn: 'root',
})
export class AuthRepository {
	private readonly apiSdk = inject(ApiSdkService);

	async register(request: RegisterRequest): Promise<AuthUser> {
		return this.apiSdk.POST.auth('/register', { params: request });
	}

	async logIn(request: LoginRequest): Promise<void> {
		return this.apiSdk.POST.auth('/login', { params: request });
	}

	async logOut(): Promise<void> {
		return this.apiSdk.GET.auth('/logout', { cancellable: false });
	}

	async refreshSession(): Promise<void> {
		return this.apiSdk.GET.auth('/refresh-session', { cancellable: false });
	}

	/** Who the session cookies belong to. Answers 401 when there is no session. */
	async getCurrentUser(): Promise<AuthUser> {
		return this.apiSdk.GET.auth('/me', { cancellable: false });
	}
}
