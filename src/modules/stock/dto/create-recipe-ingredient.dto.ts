
import { IsInt, IsNotEmpty, IsNumber } from 'class-validator';

export class CreateRecipeIngredientDto {
  @IsInt()
  @IsNotEmpty()
  menuItemId: number;

  @IsInt()
  @IsNotEmpty()
  ingredientId: number;

  @IsNumber()
  @IsNotEmpty()
  quantity: number;
}
