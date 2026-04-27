import { IsNumber, IsOptional, IsPositive, Min } from 'class-validator';

export class NutritionalInfo {
  @IsOptional() // Crucial: Permite que el valor sea null o undefined
  @IsNumber()
  @IsPositive()
  calories: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  protein: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  carbohydrates: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  fat: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  sugar?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  sodium?: number | null;
}