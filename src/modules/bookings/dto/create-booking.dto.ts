import { IsNotEmpty, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateBookingDto {
  @ApiProperty({ description: 'The ID of the MealShift to book', example: 1 })
  @IsNumber()
  @IsNotEmpty()
  mealShiftId: number;
}
