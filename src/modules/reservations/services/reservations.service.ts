import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Reservation, ReservationStatus } from '../entities/reservation.entity';
import { Timeslot } from '../entities/timeslot.entity';
import { WaitingListEntry, WaitlistStatus } from '../entities/waiting-list-entry.entity';
import { CreateReservationDto } from '../dto/create-reservation.dto';
import { MenuOption } from 'src/modules/menus/entities/menu-option.entity';
import { User } from 'src/modules/users/entities/user.entity';
import { TicketService } from 'src/modules/tickets/services/ticket.service';
import { ProductionService } from 'src/modules/production/production/production.service';
import { TenantAwareRepository } from 'src/common/repository/tenant-aware.repository';
import * as crypto from 'crypto';
import { format } from 'date-fns';

@Injectable()
export class ReservationsService {
  constructor(
    @InjectRepository(Reservation)
    private readonly reservationRepository: Repository<Reservation>,
    @InjectRepository(Timeslot)
    private readonly timeslotRepository: Repository<Timeslot>,
    @InjectRepository(WaitingListEntry)
    private readonly waitlistRepository: Repository<WaitingListEntry>,
    @InjectRepository(MenuOption)
    private readonly menuOptionRepository: Repository<MenuOption>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly ticketService: TicketService,
    private readonly productionService: ProductionService,
  ) {}

  /**
   * Main reservation logic:
   * 1. Capacity check (C > ΣRi + r)
   * 2. Duplicate booking check (One per user per menu day)
   * 3. Allergen/Health validation placeholder
   * 4. Confirmation or WaitingList entry
   */
  async createReservation(
    createDto: CreateReservationDto,
    userId: number,
    companyId: number,
  ): Promise<Reservation | WaitingListEntry> {
    const { menuOptionId, timeslotId } = createDto;

    // 1. Fetch related entities
    const menuOption = await this.menuOptionRepository.findOne({
      where: { id: menuOptionId, companyId },
      relations: { menuDay: true, menuItem: true, shifts: true },
    });

    if (!menuOption) {
      throw new NotFoundException('Selected menu option not found or access denied');
    }

    const timeslot = await TenantAwareRepository.findOneByTenant(
      this.timeslotRepository,
      timeslotId,
      companyId,
      { relations: { shift: true } },
    );

    if (!timeslot) {
      throw new NotFoundException('Selected timeslot not found or access denied');
    }

    // Validate that the timeslot's shift is one of the shifts allowed for this menu option
    const isShiftValid = menuOption.shifts.some((s) => s.id === timeslot.shiftId);
    if (!isShiftValid) {
      throw new BadRequestException(
        `The selected timeslot belongs to shift "${timeslot.shift?.name}", but this menu option is only available for: ${menuOption.shifts.map((s) => s.name).join(', ')}`,
      );
    }

    const user = await this.userRepository.findOne({
      where: { id: userId, companyId },
      relations: { observations: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // 2. Duplicate booking check (One per user per shift per day)
    const dateString = format(menuOption.menuDay.date, 'yyyy-MM-dd');
    
    const existing = await this.reservationRepository.findOne({
      where: {
        userId,
        timeslot: { shiftId: timeslot.shiftId },
        menuOption: {
          menuDay: {
            date: dateString as any,
          },
        },
        status: ReservationStatus.CONFIRMED,
      },
      relations: { menuOption: { menuDay: true }, timeslot: true },
    });

    if (existing) {
      throw new BadRequestException(
        `User already has a confirmed reservation for the shift "${timeslot.shift?.name}" on ${dateString}`,
      );
    }

    // 3. Validation placeholder for health/allergens
    await this.validateUserHealthCompatibilty(userId, menuOptionId);

    // 4. Capacity check (C > ΣRi + r)
    // Occupancy is relative to the specific Timeslot on the specific MenuDay
    const currentOccupancy = await this.reservationRepository.count({
      where: {
        timeslotId,
        status: ReservationStatus.CONFIRMED,
        menuOption: { menuDayId: menuOption.menuDayId },
      },
    });

    if (currentOccupancy < timeslot.capacity) {
      // CONFIRM RESERVATION
      const ticketCode = this.generateTicketCode();
      const reservation = this.reservationRepository.create({
        userId,
        menuOptionId,
        timeslotId,
        companyId,
        status: ReservationStatus.CONFIRMED,
        ticketCode,
      });

      const savedReservation = await this.reservationRepository.save(reservation);

      // AUTOMATIC TICKET GENERATION
      await this.ticketService.createFromReservation(
        user,
        menuOption.menuItem.id,
        menuOption.menuDay.date,
        timeslot.shift,
        companyId,
      );

      // SYNC PICKING LIST IN REAL-TIME
      await this.productionService.syncPickingListForShift(
        companyId,
        format(menuOption.menuDay.date, 'yyyy-MM-dd'),
        timeslot.shiftId,
      );

      return savedReservation;
    } else {
      // ADD TO WAITING LIST
      const lastEntry = await this.waitlistRepository.findOne({
        where: { timeslotId, status: WaitlistStatus.PENDING },
        order: { priority: 'DESC' },
      });
      const priority = (lastEntry?.priority || 0) + 1;

      const waitlistEntry = this.waitlistRepository.create({
        userId,
        menuOptionId,
        timeslotId,
        companyId,
        status: WaitlistStatus.PENDING,
        priority,
      });

      return this.waitlistRepository.save(waitlistEntry);
    }
  }

  private async validateUserHealthCompatibilty(userId: number, menuOptionId: string) {
    // Placeholder for health validation logic
    // In the future, this will check User observations vs MenuOption/Product allergens.
    return true;
  }

  private generateTicketCode(): string {
    // Generates a random unique code: TKT-XXXXXX
    return `TKT-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  }

  async findAll(companyId: number): Promise<any[]> {
    const reservations = await TenantAwareRepository.findAllByTenant(this.reservationRepository, companyId, {
      relations: {
        user: true,
        menuOption: {
          menuDay: true,
          menuItem: { recipeIngredients: { ingredient: true } },
        },
        timeslot: { shift: true },
      },
    });
    return reservations.map((res) => this.mapReservationResponse(res));
  }

  async findMyReservations(userId: number, companyId: number): Promise<any[]> {
    const reservations = await this.reservationRepository.find({
      where: { userId, companyId },
      relations: {
        menuOption: {
          menuDay: true,
          menuItem: { recipeIngredients: { ingredient: true } },
        },
        timeslot: { shift: true },
      },
    });
    return reservations.map((res) => this.mapReservationResponse(res));
  }

  async findWaitlistEntries(companyId: number): Promise<any[]> {
    const entries = await TenantAwareRepository.findAllByTenant(this.waitlistRepository, companyId, {
      relations: {
        user: true,
        menuOption: {
          menuDay: true,
          menuItem: { recipeIngredients: { ingredient: true } },
        },
        timeslot: { shift: true },
      },
    });
    return entries.map((entry) => this.mapReservationResponse(entry));
  }

  private mapReservationResponse(res: any) {
    return {
      ...res,
      user: res.user
        ? {
            id: res.user.id,
            name: `${res.user.firstName || ''} ${res.user.lastName || ''}`.trim(),
            firstName: res.user.firstName,
            lastName: res.user.lastName,
            email: res.user.email,
            username: res.user.username,
            companyId: res.user.companyId,
            role: res.user.role,
            isActive: res.user.isActive,
          }
        : null,
      menuOptionName: res.menuOption?.menuItem?.name,
      shiftName: res.timeslot?.shift?.name,
      date: res.menuOption?.menuDay?.date,
      ingredients:
        res.menuOption?.menuItem?.recipeIngredients?.map((ri: any) => ({
          id: ri.ingredient?.id,
          name: ri.ingredient?.name,
          quantity: ri.quantity,
          unit: ri.ingredient?.unit,
        })) || [],
    };
  }
}
