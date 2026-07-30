import { Injectable } from '@nestjs/common';

import { ConfigurationService } from '../../shared/module/config/configuration.service';

@Injectable()
export class AppService {
	constructor(private readonly configService: ConfigurationService) {}

	welcomeMessage() {
		return { message: 'Welcome to Play Set Online!' };
	}
}
