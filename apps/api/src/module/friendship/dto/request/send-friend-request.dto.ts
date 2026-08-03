import type { SendFriendRequest } from '@chesspecker/api-definitions';
import { IsNotEmpty, IsString } from 'class-validator';

export class SendFriendRequestDto implements SendFriendRequest {
	@IsString()
	@IsNotEmpty()
	username!: string;
}
