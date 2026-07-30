import { IsNotEmpty, IsString } from 'class-validator';

export class BlockUserRequestDto {
	@IsString()
	@IsNotEmpty()
	username!: string;
}
