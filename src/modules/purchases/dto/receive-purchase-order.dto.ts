import {
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ReceivePurchaseOrderItemDto {
  @ApiProperty({ description: 'ID del item de la orden de compra' })
  @IsNotEmpty()
  @IsNumber()
  itemId: number;

  @ApiProperty({ description: 'Cantidad real recibida' })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  receivedQuantity: number;

  @ApiProperty({ description: 'Costo unitario real al recibir' })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  unitCost: number;

  @ApiProperty({ description: 'Número de lote del proveedor' })
  @IsNotEmpty()
  @IsString()
  lot: string;

  @ApiPropertyOptional({ description: 'Fecha de vencimiento' })
  @IsOptional()
  @IsDateString()
  expirationDate?: string;
}

export class ReceivePurchaseOrderDto {
  @ApiProperty({ type: [ReceivePurchaseOrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReceivePurchaseOrderItemDto)
  items: ReceivePurchaseOrderItemDto[];
}
