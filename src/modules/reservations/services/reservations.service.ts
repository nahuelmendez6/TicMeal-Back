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
import { TenantAwareRepository } from 'src/common/repository/tenant-aware.repository';
import * as crypto from 'crypto';

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
      relations: { menuDay: true, menuItem: true },
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

    const user = await this.userRepository.findOne({
      where: { id: userId, companyId },
      relations: { observations: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // 2. Duplicate booking check (One per user per menu day)
    const existing = await this.reservationRepository.findOne({
      where: {
        userId,
        menuOption: { menuDayId: menuOption.menuDayId },
        status: ReservationStatus.CONFIRMED,
      },
      relations: { menuOption: true }
    });

    if (existing) {
      throw new BadRequestException('User already has a confirmed reservation for this day');
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

  async findAll(companyId: number): Promise<Reservation[]> {
    return TenantAwareRepository.findAllByTenant(this.reservationRepository, companyId, {
      relations: { user: true, menuOption: { menuDay: true }, timeslot: true },
    });
  }

  async findMyReservations(userId: number, companyId: number): Promise<Reservation[]> {
    return this.reservationRepository.find({
      where: { userId, companyId },
      relations: { menuOption: { menuDay: true }, timeslot: true },
    });
  }

  async findWaitlistEntries(companyId: number): Promise<WaitingListEntry[]> {
    return TenantAwareRepository.findAllByTenant(this.waitlistRepository, companyId, {
      relations: { user: true, menuOption: { menuDay: true }, timeslot: true },
    });
  }
}
