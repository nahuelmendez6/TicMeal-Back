import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsInt } from 'class-validator';

export class CreateReservationDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440001' })
  @IsNotEmpty()
  @IsString()
  menuOptionId: string;

  @ApiProperty({ example: 1 })
  @IsNotEmpty()
  @IsInt()
  timeslotId: number;
}
