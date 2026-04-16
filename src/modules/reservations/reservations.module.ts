import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Reservation } from './entities/reservation.entity';
import { Timeslot } from './entities/timeslot.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Reservation, Timeslot]),
  ],
  controllers: [],
  providers: [],
  exports: [TypeOrmModule],
})
export class ReservationsModule {}
