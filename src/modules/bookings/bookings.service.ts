import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Booking, BookingStatus } from './entities/booking.entity';
import { CreateBookingDto } from './dto/create-booking.dto';
import { MealShift } from 'src/modules/stock/entities/meal-shift.entity';
import { User } from 'src/modules/users/entities/user.entity';
import { Observation } from 'src/modules/users/entities/observation.entity';
import { TenantAwareRepository } from 'src/common/repository/tenant-aware.repository';
import { CompatibilityUtil } from 'src/common/utils/compatibility.util';
import { MenuItemService } from 'src/modules/stock/services/menu-item.service';

@Injectable()
export class BookingsService {
  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
    @InjectRepository(MealShift)
    private readonly mealShiftRepository: Repository<MealShift>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Observation)
    private readonly observationRepository: Repository<Observation>,
    private readonly menuItemService: MenuItemService,
  ) {}

  async createBooking(
    createBookingDto: CreateBookingDto,
    userId: number,
    companyId: number,
  ): Promise<Booking> {
    const { mealShiftId } = createBookingDto;

    // 1. Fetch MealShift and check availability
    const mealShift = await TenantAwareRepository.findOneByTenant(this.mealShiftRepository, mealShiftId, companyId, {
      relations: {
        menuItem: {
          observations: true,
          recipeIngredients: {
            ingredient: {
              observations: true,
            },
          },
        },
      }, // Load menuItem and its aggregated observations context
    });

    if (!mealShift) {
      throw new NotFoundException(`MealShift with ID ${mealShiftId} not found.`);
    }

    if (mealShift.quantityAvailable <= 0) {
      throw new BadRequestException('No availability for this MealShift.');
    }

    // 2. Fetch User with their observations
    const user = await TenantAwareRepository.findOneByTenant(this.userRepository, userId, companyId, {
      relations: {
        observations: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found.`);
    }

    // 3. Compare observations for conflicts using CompatibilityUtil
    const aggregatedObs = this.menuItemService.getAggregatedObservations(
      mealShift.menuItem,
    );
    
    const compatibility = CompatibilityUtil.evaluate(
      user.observations || [],
      aggregatedObs,
    );

    if (!compatibility.isCompatible) {
      const conflictNames = compatibility.conflicts.map((o) => o.name).join(', ');
      throw new BadRequestException(
        `Booking conflict: User has dietary restrictions or preference mismatches: ${conflictNames}`,
      );
    }

    // 4. Create and save the Booking
    const booking = this.bookingRepository.create({
      userId,
      mealShiftId,
      companyId, // Inherited from BaseTenantEntity
      status: BookingStatus.CONFIRMED,
    });

    await this.bookingRepository.save(booking);

    // 5. Decrement mealShift.quantityAvailable and save MealShift
    mealShift.quantityAvailable -= 1;
    await this.mealShiftRepository.save(mealShift);

    return booking;
  }

  async findAllBookings(companyId: number): Promise<Booking[]> {
    return TenantAwareRepository.findAllByTenant(this.bookingRepository, companyId, {
      relations: {
        user: true,
        mealShift: {
          menuItem: true,
        },
      }, // Load related data for full context
    });
  }
}
