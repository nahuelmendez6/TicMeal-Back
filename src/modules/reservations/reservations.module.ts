import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Reservation } from './entities/reservation.entity';
import { Timeslot } from './entities/timeslot.entity';
import { WaitingListEntry } from './entities/waiting-list-entry.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Reservation, Timeslot, WaitingListEntry]),
  ],
  controllers: [],
  providers: [],
  exports: [TypeOrmModule],
})
export class ReservationsModule {}
