import { IsEmail, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateInvitationDto {
  @ApiProperty({ example: 'diner@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
