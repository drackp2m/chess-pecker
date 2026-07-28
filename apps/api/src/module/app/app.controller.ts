import { Controller, Get } from '@nestjs/common';

import { Public } from '../auth/decorator/public.decorator';

@Public()
@Controller('')
export class AppController {
	@Get('api')
	api(): string {
		return this.root();
	}

	@Get('')
	root(): string {
		const now = new Date().toISOString();

		return `Api online at ${now}`;
	}
}
