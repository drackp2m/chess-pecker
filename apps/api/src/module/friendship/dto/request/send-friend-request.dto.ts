import { IsNotEmpty, IsString } from 'class-validator';

export class SendFriendRequestDto {
	@IsString()
	@IsNotEmpty()
	username!: string;
}
