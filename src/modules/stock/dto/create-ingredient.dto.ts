import {
  IsOptional,
  IsString,
  IsUUID,
  Length,
  IsNumber,
  IsEnum,
  IsBoolean,
  IsPositive,
  IsNumberString,
  IsObject,
  Min,
  Max,
  IsArray,
  IsInt,
} from 'class-validator';
import { IngredientUnit, IngredientCostType } from '../enums/enums';
import { NutritionalInfo } from './nutritional-info.dto';

export class CreateIngredientDto {
  /** Tenant (heredado de BaseTenantEntity) */
  @IsOptional()
  @IsNumber()
  companyId?: number | null;

  /** Nombre */
  @IsString()
  @Length(1, 50)
  name: string;

  /** Stock inicial */
  @IsOptional()
  @IsNumber()
  quantityInStock?: number;

  /** Unidad (enum) */
  @IsEnum(IngredientUnit)
  unit: IngredientUnit;

  /** Costo de referencia opcional */
  @IsOptional()
  @IsNumber()
  referenceCost?: number | null;

  /** Tipo de costo opcional */
  @IsOptional()
  @IsEnum(IngredientCostType)
  costType?: IngredientCostType | null;

  /** Descripción */
  @IsOptional()
  @IsString()
  description?: string | null;

  /** Categoría del ingrediente */
  @IsOptional()
  @IsNumber()
  categoryId?: number | null;

  /**
   * Propiedad enviada por el frontend que no se utiliza en el backend.
   * Se permite para evitar errores de validación, pero se ignora en la lógica del servicio.
   */
  @IsOptional()
  @IsObject()
  category?: any;

  /** Stock mínimo recomendado */
  @IsOptional()
  @IsNumber()
  minStock?: number | null;

  /** Porcentaje de merma/rendimiento (0-100) */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  shrinkagePercentage?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isFresh?: boolean;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  observationIds?: number[];

  @IsOptional()
  nutritionalInfo?: NutritionalInfo;

  @IsOptional()
  @IsInt()
  defaultSupplierId?: number;
}
