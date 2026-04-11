import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MenusService } from './menus.service';
import { MenusController } from './menus.controller';
import { Menu } from './entities/menu.entity';
import { MenuDay } from './entities/menu-day.entity';
import { MenuOption } from './entities/menu-option.entity';
import { ShiftModule } from '../shift/shift.module';
import { MenusController } from './menus/menus.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Menu, MenuDay, MenuOption]),
    ShiftModule,
  ],
  controllers: [MenusController],
  providers: [MenusService],
})
export class MenusModule {}
