import {
  IsString,
  IsInt,
  IsOptional,
  Min,
  IsNumber,
  IsArray,
  ValidateNested,
  IsPositive,
  IsBoolean,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { NutritionalInfo } from './nutritional-info.dto';

import { MenuItemType } from '../enums/menuItemTypes';

/**
 * DTO para un ingrediente dentro de la receta de un MenuItem.
 */
class RecipeIngredientDto {
  @IsInt()
  ingredientId: number;

  @IsNumber()
  @IsPositive()
  quantity: number;
}

/**
 * DTO para crear un nuevo item del menu
 */
export class CreateMenuItemDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  iconName?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  cost?: number;

  @IsOptional()
  @IsInt()
  categoryId?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  minStock?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsNumber()
  maxOrder?: number;

  @IsOptional()
  @IsEnum(MenuItemType)
  type?: MenuItemType;

  @IsOptional()
  @ValidateNested()
  @Type(() => NutritionalInfo)
  nutritionalInfo?: NutritionalInfo;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecipeIngredientDto)
  recipeIngredients?: RecipeIngredientDto[];
}
