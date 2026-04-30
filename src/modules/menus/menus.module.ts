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
import { Company } from '../companies/entities/company.entity';
import { StockModule } from '../stock/stock.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Menu, MenuDay, MenuOption, Shift, User, Company]),
    ShiftModule,
    forwardRef(() => StockModule),
    MailModule,
  ],
  controllers: [MenusController],
  providers: [MenusService],
  exports: [MenusService],
})
export class MenusModule {}
