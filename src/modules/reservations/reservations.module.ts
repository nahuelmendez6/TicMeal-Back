import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Reservation } from './entities/reservation.entity';
import { Timeslot } from './entities/timeslot.entity';
import { WaitingListEntry } from './entities/waiting-list-entry.entity';

import { TimeslotsController } from './controllers/timeslots.controller';
import { TimeslotsService } from './services/timeslots.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Reservation, Timeslot, WaitingListEntry]),
  ],
  controllers: [TimeslotsController],
  providers: [TimeslotsService],
  exports: [TypeOrmModule, TimeslotsService],
})
export class ReservationsModule {}
