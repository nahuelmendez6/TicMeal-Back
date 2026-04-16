import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Reservation } from './entities/reservation.entity';
import { Timeslot } from './entities/timeslot.entity';
import { WaitingListEntry } from './entities/waiting-list-entry.entity';
import { User } from 'src/modules/users/entities/user.entity';
import { MenuOption } from 'src/modules/menus/entities/menu-option.entity';

import { TimeslotsController } from './controllers/timeslots.controller';
import { TimeslotsService } from './services/timeslots.service';
import { ReservationsController } from './controllers/reservations.controller';
import { ReservationsService } from './services/reservations.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Reservation,
      Timeslot,
      WaitingListEntry,
      User,
      MenuOption,
    ]),
  ],
  controllers: [TimeslotsController, ReservationsController],
  providers: [TimeslotsService, ReservationsService],
  exports: [TypeOrmModule, TimeslotsService, ReservationsService],
})
export class ReservationsModule {}
