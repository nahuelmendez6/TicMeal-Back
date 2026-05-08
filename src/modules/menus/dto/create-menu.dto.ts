import { IsNotEmpty, IsString, IsDateString, IsEnum, IsOptional } from 'class-validator';
import { MenuPeriodicity, MenuStatus } from '../entities/menu.entity';

export class CreateMenuDto {
  // @IsNotEmpty()
  // @IsString()
  // name: string;

  @IsNotEmpty()
  @IsDateString()
  startDate: Date;

  @IsNotEmpty()
  @IsDateString()
  endDate: Date;

  @IsNotEmpty()
  @IsEnum(MenuPeriodicity)
  periodicity: MenuPeriodicity;

  @IsOptional() // O @IsNotEmpty() según tu lógica de negocio
  @IsEnum(MenuStatus, {
    message: 'status debe ser uno de: DRAFT, PUBLISHED, ARCHIVED',
  })
  status: MenuStatus;
}
