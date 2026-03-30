import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsEnum,
} from 'class-validator';
import { StockAuditType } from '../enums/stock-audit-type.enum';

export class CreateStockAuditDto {
  @IsEnum(StockAuditType)
  @IsNotEmpty()
  auditType: StockAuditType;

  @IsNumber()
  @IsOptional()
  ingredientId?: number;

  @IsNumber()
  @IsOptional()
  menuItemId?: number;

  @IsNumber()
  @IsNotEmpty()
  physicalStock: number;

  @IsOptional()
  @IsString()
  observations?: string;
}
