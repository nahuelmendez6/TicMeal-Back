import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm'; // Import this
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { Booking } from './entities/booking.entity'; // Import your entities
import { MealShift } from 'src/modules/stock/entities/meal-shift.entity';
import { User } from 'src/modules/users/entities/user.entity';
import { Observation } from 'src/modules/users/entities/observation.entity';
import { StockModule } from '../stock/stock.module';

@Module({
  imports: [
    // This line tells Nest to provide the repositories for these entities
    TypeOrmModule.forFeature([
      Booking, 
      MealShift, 
      User, 
      Observation
    ]),
    StockModule,
  ],
  controllers: [BookingsController],
  providers: [BookingsService],
  exports: [BookingsService], // Export if other modules (like Production) need it
})
export class BookingsModule {}