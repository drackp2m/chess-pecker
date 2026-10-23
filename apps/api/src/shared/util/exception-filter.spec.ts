import { ArgumentsHost, BadRequestException, HttpException, HttpStatus } from '@nestjs/common';

import { TooManyRequestsException } from '../exception/too-many-requests.exception';

import { HttpExceptionFilter } from './exception-filter';

const IP = '203.0.113.7';

function answerTo(exception: HttpException) {
	const json = vi.fn((_body: unknown) => undefined);
	const status = vi.fn((_code: number) => ({ json }));
	const host = {
		switchToHttp: () => ({
			getResponse: () => ({ status }),
			getRequest: () => ({ ip: IP }),
		}),
	} as unknown as ArgumentsHost;

	new HttpExceptionFilter().catch(exception, host);

	return { status, json };
}

describe('HttpExceptionFilter', () => {
	it('answers an exception of its own with its message and its status', () => {
		const { status, json } = answerTo(new TooManyRequestsException());

		expect(status).toHaveBeenCalledWith(HttpStatus.TOO_MANY_REQUESTS);
		expect(json).toHaveBeenCalledWith(
			expect.objectContaining({
				message: 'Too many requests',
				statusCode: HttpStatus.TOO_MANY_REQUESTS,
				ip: IP,
			}),
		);
	});

	it('answers a Nest exception with the body Nest built for it', () => {
		const { status, json } = answerTo(new BadRequestException('the request is malformed'));

		expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
		expect(json).toHaveBeenCalledWith({
			message: 'the request is malformed',
			error: 'Bad Request',
			statusCode: HttpStatus.BAD_REQUEST,
			ip: IP,
		});
	});

	it('answers an exception built from a plain string instead of leaving the request open', () => {
		const { status, json } = answerTo(new HttpException('not today', HttpStatus.I_AM_A_TEAPOT));

		expect(status).toHaveBeenCalledWith(HttpStatus.I_AM_A_TEAPOT);
		expect(json).toHaveBeenCalledWith({
			message: 'not today',
			statusCode: HttpStatus.I_AM_A_TEAPOT,
			ip: IP,
		});
	});
});
