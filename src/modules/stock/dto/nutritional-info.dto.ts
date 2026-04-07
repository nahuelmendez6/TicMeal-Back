import { IsNumber, IsOptional, IsPositive, Min } from 'class-validator';

// src/modules/stock/dto/nutritional-info.dto.ts
export class NutritionalInfo {
  @IsNumber()
  @IsPositive()
  calories: number; // por 100g o por unidad base

  @IsNumber()
  @Min(0)
  protein: number; // gramos

  @IsNumber()
  @Min(0)
  carbohydrates: number; // gramos

  @IsNumber()
  @Min(0)
  fat: number; // gramos

  @IsOptional()
  @IsNumber()
  @Min(0)
  sugar?: number; // gramos

  @IsOptional()
  @IsNumber()
  @Min(0)
  sodium?: number; // miligramos
  // ... otros nutrientes que necesites
}
