import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsEnum,
  IsDateString,
  ValidateIf,
} from 'class-validator';
import { MovementType } from '../enums/enums';

export class CreateStockMovementDto {
  @IsOptional()
  @IsNumber()
  menuItemId?: number;

  @IsOptional()
  @IsNumber()
  ingredientId?: number;

  @IsNotEmpty()
  @IsEnum(MovementType)
  movementType: MovementType;

  @IsNotEmpty()
  @IsNumber()
  quantity: number;

  @IsOptional() // Se hace opcional
  @IsString()
  reason?: string;

  // --- Campos para Lotes ---

  // Para movimientos de SALIDA, se debe especificar el ID del lote a consumir
  @ValidateIf((o) => o.movementType === MovementType.OUT)
  @IsNumber()
  @IsOptional() // Se puede usar uno u otro
  ingredientLotId?: number;

  @ValidateIf((o) => o.movementType === MovementType.OUT)
  @IsNumber()
  @IsOptional()
  menuItemLotId?: number;

  // Para movimientos de ENTRADA, estos campos describen el lote
  @ValidateIf((o) => o.movementType === MovementType.IN)
  @IsString()
  @IsOptional()
  lotNumber?: string;

  @ValidateIf((o) => o.movementType === MovementType.IN)
  @IsNumber()
  @IsOptional()
  unitCost?: number;

  @IsOptional()
  @IsDateString()
  expirationDate?: string;

  @IsOptional()
  @IsString()
  relatedTicketId?: string;

  @IsOptional()
  @IsNumber()
  auditId?: number;

  @IsOptional()
  @IsNumber()
  purchaseOrderItemId?: number;
}
