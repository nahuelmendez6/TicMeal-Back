import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  Min,
  IsEnum,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';
import { Periodicity } from '../entities/meal-shift.entity';

export class CreateMealShiftDto {
  @IsEnum(Periodicity)
  periodicity: Periodicity;

  @IsDateString()
  startDate: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsArray()
  @IsInt({ each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(7)
  @IsOptional()
  daysOfWeek?: number[]; // 0 for Sunday, 1 for Monday, etc.

  @IsInt()
  shiftId: number;

  @IsInt()
  menuItemId: number;

  @IsNumber()
  @Min(0)
  quantityProduced: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  quantityAvailable?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
