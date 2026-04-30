import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TicketService } from './services/ticket.service';
import { TicketController } from './controllers/ticket.controller';
import { Ticket } from './entities/ticket.entity';
import { TicketItem } from './entities/ticket-item.entity';
import { User } from '../users/entities/user.entity';
import { Shift } from '../shift/entities/shift.entity';
import { MenuItems } from '../stock/entities/menu-items.entity';
import { Observation } from '../users/entities/observation.entity';
import { UsersModule } from '../users/users.module';
import { ShiftModule } from '../shift/shift.module';
import { StockModule } from '../stock/stock.module';
import { StockMovement } from '../stock/entities/stock-movement.entity';
import { Ingredient } from '../stock/entities/ingredient.entity';

import { TicketGateway } from './services/ticket.gateway';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Ticket,
      TicketItem,
      User,
      Shift,
      MenuItems,
      Observation,
      StockMovement,
      Ingredient,
    ]),
    UsersModule,
    ShiftModule,
    StockModule,
  ],
  controllers: [TicketController],
  providers: [TicketService, TicketGateway], // TicketService ahora puede inyectar UsersService y ShiftService
  exports: [TicketService],
})
export class TicketModule {}
