import { IsNotEmpty, IsString, IsDateString, IsEnum } from 'class-validator';
import { MenuPeriodicity } from '../entities/menu.entity';

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
}
