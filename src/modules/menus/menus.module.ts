import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MenusService } from './menus.service';
import { Menu } from './entities/menu.entity';
import { MenuDay } from './entities/menu-day.entity';
import { MenuOption } from './entities/menu-option.entity';
import { ShiftModule } from '../shift/shift.module';
import { Shift } from '../shift/entities/shift.entity';
import { MenusController } from './menus.controller';
import { User } from '../users/entities/user.entity';
import { StockModule } from '../stock/stock.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Menu, MenuDay, MenuOption, Shift, User]),
    ShiftModule,
    forwardRef(() => StockModule),
  ],
  controllers: [MenusController],
  providers: [MenusService],
  exports: [MenusService],
})
export class MenusModule {}
