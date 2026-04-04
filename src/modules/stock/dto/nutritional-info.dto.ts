// src/modules/stock/dto/nutritional-info.dto.ts
export class NutritionalInfo {
  calories: number; // por 100g o por unidad base
  protein: number; // gramos
  carbohydrates: number; // gramos
  fat: number; // gramos
  sugar?: number; // gramos
  sodium?: number; // miligramos
  // ... otros nutrientes que necesites
}
