import { IsNotEmpty, IsString, IsUUID, IsArray, IsNumber, ArrayMinSize, ArrayNotEmpty } from 'class-validator';

export class AddMenuOptionDto {
  @IsNotEmpty()
  @IsUUID()
  productId: string;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayMinSize(1)
  @IsNumber({}, { each: true })
  shiftIds: number[];
}
