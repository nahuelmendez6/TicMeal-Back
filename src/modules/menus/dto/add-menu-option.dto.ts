import { IsNotEmpty, IsString, IsUUID, IsArray, IsNumber, ArrayMinSize, ArrayNotEmpty, IsDateString } from 'class-validator';

export class AddMenuOptionDto {
  @IsNotEmpty()
  @IsDateString()
  date: string;

  @IsNotEmpty()
  @IsUUID()
  menuId: string;

  @IsNotEmpty()
  @IsNumber()
  menuItemId: number;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayMinSize(1)
  @IsNumber({}, { each: true })
  shiftIds: number[];
}
