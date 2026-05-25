import { PartialType } from '@nestjs/mapped-types';
import { CreateMenuItemDto } from './create-menu-item-dto';
import { IsNumber, IsOptional } from 'class-validator';

/**
 * DTO para actualizar un item del menu (todos los campos son opcionales)
 */

export class UpdateMenuItemDto extends PartialType(CreateMenuItemDto) {
  @IsOptional()
  @IsNumber()
  productionCost?: number;
}
