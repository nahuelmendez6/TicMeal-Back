import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Min } from 'class-validator';

export class UpdatePickedQuantityDto {
  @ApiProperty({ example: 10.5, description: 'The actual quantity collected from the warehouse' })
  @IsNumber()
  @Min(0)
  pickedQuantity: number;
}
