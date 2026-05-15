import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { TenantAwareRepository } from 'src/common/repository/tenant-aware.repository';
import {
  Booking,
  BookingStatus,
} from 'src/modules/bookings/entities/booking.entity';
import { Reservation, ReservationStatus } from 'src/modules/reservations/entities/reservation.entity';
import { MealShift, Periodicity } from 'src/modules/stock/entities/meal-shift.entity';
import { Company } from 'src/modules/companies/entities/company.entity';
import { Repository } from 'typeorm';
import { addDays, format, isSameDay, getDay } from 'date-fns';
import { isWithinInterval } from 'date-fns/isWithinInterval'
import { Ingredient } from 'src/modules/stock/entities/ingredient.entity';
import { MenuItems } from 'src/modules/stock/entities/menu-items.entity';
import { RecipeIngredient } from 'src/modules/stock/entities/recipe-ingredient.entity';
import {
  PickingList,
  PickingListStatus,
} from '../entities/picking-list.entity';
import { PickingListItem } from '../entities/picking-list-item.entity';
import { PurchaseOrder } from 'src/modules/purchases/entities/purchase-order.entity'; // Use existing PurchaseOrder entity
import { PurchaseOrderItem } from 'src/modules/purchases/entities/purchase-order-item.entity';
import { Supplier } from 'src/modules/suppliers/entities/supplier.entity';
import { PurchaseOrderStatus } from 'src/modules/purchases/enums/purchase-order-status.enum';

import { StockMovement } from 'src/modules/stock/entities/stock-movement.entity';
import { MovementType } from 'src/modules/stock/enums/enums';
import { UpdatePickedQuantityDto } from '../dto/update-picked-quantity.dto';
import { User } from 'src/modules/users/entities/user.entity';

@Injectable()
export class ProductionService {
  private readonly logger = new Logger(ProductionService.name);

  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
    @InjectRepository(Reservation)
    private readonly reservationRepository: Repository<Reservation>,
    @InjectRepository(MealShift)
    private readonly mealShiftRepository: Repository<MealShift>,
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>, // Company is not tenant-aware in its own context
    @InjectRepository(Ingredient)
    private readonly ingredientRepository: Repository<Ingredient>,
    @InjectRepository(MenuItems)
    private readonly menuItemsRepository: Repository<MenuItems>,
    @InjectRepository(RecipeIngredient)
    private readonly recipeIngredientRepository: Repository<RecipeIngredient>,
    @InjectRepository(PickingList)
    private readonly pickingListRepository: Repository<PickingList>,
    @InjectRepository(PickingListItem)
    private readonly pickingListItemRepository: Repository<PickingListItem>,
    @InjectRepository(StockMovement)
    private readonly stockMovementRepository: Repository<StockMovement>,
    @InjectRepository(PurchaseOrder)
    private readonly purchaseOrderRepository: Repository<PurchaseOrder>, // For JIT purchase orders
    @InjectRepository(PurchaseOrderItem)
    private readonly purchaseOrderItemRepository: Repository<PurchaseOrderItem>,
    @InjectRepository(Supplier)
    private readonly supplierRepository: Repository<Supplier>, // To find a default supplier for JIT orders
  ) {}

      private isMealShiftActiveForDate(
    mealShift: MealShift,
    targetDate: Date,
  ): boolean {
    // Check if targetDate is within the mealShift's active interval
    const isWithinActiveInterval = isWithinInterval(targetDate, {
      start: mealShift.startDate,
      end: mealShift.endDate || targetDate, // If no end date, it's active indefinitely from start date
    });

    if (!isWithinActiveInterval) {
      return false;
    }

    switch (mealShift.periodicity) {
      case Periodicity.ONCE:
        return isSameDay(mealShift.startDate, targetDate); // For ONCE, it must be the exact start date
      case Periodicity.DAILY:
        return true; // Always active within the interval
      case Periodicity.WEEKLY:
        const targetDay = getDay(targetDate); // 0 for Sunday, 1 for Monday, etc.
        return mealShift.daysOfWeek?.includes(targetDay) || false;
      default:
        return false;
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_2AM) // Runs every day at 2 AM
  async handleProductionPlan() {
    this.logger.log('Starting daily production plan generation...');

    const targetDate = addDays(new Date(), 1); // Get tomorrow's date
    const formattedTargetDate = format(targetDate, 'yyyy-MM-dd');

    const companies = await this.companyRepository.find();

    for (const company of companies) {
      this.logger.log(
        `Processing company: ${company.name} (ID: ${company.id}) for ${formattedTargetDate}`,
      );

      // 1. Get all MealShifts for the company
      const allMealShifts = await TenantAwareRepository.findAllByTenant(
        this.mealShiftRepository,
        company.id,
      );

      // 2. Filter MealShifts that are active for the target date
      const activeMealShifts = allMealShifts.filter((mealShift) =>
        this.isMealShiftActiveForDate(mealShift, targetDate),
      );

      if (activeMealShifts.length === 0) {
        this.logger.log(
          `No active MealShifts found for ${formattedTargetDate} for company ${company.id}.`,
        );
        continue;
      }

      // Prepare to consolidate bookings
      const consolidatedBookings: { [mealShiftId: number]: number } = {};

      for (const mealShift of activeMealShifts) {
        // 3. Get all confirmed bookings for the current active MealShift
        const bookings = await TenantAwareRepository.findAllByTenant(
          this.bookingRepository,
          company.id,
          {
            where: {
              status: BookingStatus.CONFIRMED,
              mealShiftId: mealShift.id, // Filter by mealShiftId
            },
          },
        );

        if (bookings.length > 0) {
          consolidatedBookings[mealShift.id] =
            (consolidatedBookings[mealShift.id] || 0) + bookings.length;
        }
      }

      if (Object.keys(consolidatedBookings).length === 0) {
        this.logger.log(
          `No confirmed bookings for any active meal shifts for ${formattedTargetDate} for company ${company.id}.`,
        );
        continue;
      }

      // 4. Update quantityProduced for each MealShift based on consolidated bookings
      for (const mealShiftId in consolidatedBookings) {
        const totalBookedQuantity = consolidatedBookings[mealShiftId];

        const mealShift: MealShift =
          await TenantAwareRepository.findOneByTenant(
            this.mealShiftRepository,
            +mealShiftId,
            company.id,
          );

        if (mealShift) {
          const originalQuantityProduced = mealShift.quantityProduced;
          mealShift.quantityProduced = totalBookedQuantity;
          await this.mealShiftRepository.save(mealShift);
          this.logger.log(
            `Updated MealShift ID ${mealShift.id} for company ${company.id}: quantityProduced from ${originalQuantityProduced} to ${mealShift.quantityProduced}. `,
          );
        } else {
          this.logger.warn(
            `MealShift ID ${mealShiftId} not found for company ${company.id}. Bookings for this shift will not be reflected in production.`,
          );
        }
      }
      await this._processProductionForCompany(company.id, formattedTargetDate);
    }
    this.logger.log('Daily production plan generation completed.');
  }

  private async _processProductionForCompany(
    companyId: number,
    targetDate: string,
    specificShiftId?: number,
  ) {
    this.logger.log(
      `Processing production details for company ${companyId} on ${targetDate}${specificShiftId ? ` for shift ${specificShiftId}` : ''}...`,
    );

    // 1. Fetch all Shifts that have activity (MealShifts or Reservations)
    const allMealShifts = await TenantAwareRepository.findAllByTenant(
      this.mealShiftRepository,
      companyId,
      {
        relations: {
          menuItem: { recipeIngredients: { ingredient: true } },
        },
      },
    );

    const activeMealShifts = allMealShifts.filter(
      (ms) =>
        this.isMealShiftActiveForDate(ms, new Date(targetDate)) &&
        ms.quantityProduced > 0 &&
        (!specificShiftId || ms.shiftId === specificShiftId),
    );

    const reservations = await TenantAwareRepository.findAllByTenant(
      this.reservationRepository,
      companyId,
      {
        where: {
          status: ReservationStatus.CONFIRMED,
          menuOption: { menuDay: { date: targetDate as any } },
          ...(specificShiftId ? { timeslot: { shiftId: specificShiftId } } : {}),
        },
        relations: {
          timeslot: true,
          menuOption: {
            menuItem: { recipeIngredients: { ingredient: true } },
          },
        },
      },
    );

    // Group shift IDs to process
    const shiftIds = new Set<number>();
    activeMealShifts.forEach((ms) => shiftIds.add(ms.shiftId));
    reservations.forEach((res) => shiftIds.add(res.timeslot.shiftId));

    const dayConsolidatedIngredients = new Map<
      number,
      { quantity: number; ingredient: Ingredient }
    >();

    for (const shiftId of shiftIds) {
      const shiftConsolidated = await this.syncPickingListForShift(
        companyId,
        targetDate,
        shiftId,
        activeMealShifts,
        reservations,
      );
      // Aggregate for JIT check
      for (const [id, data] of shiftConsolidated.entries()) {
        this.addIngredientToConsolidation(
          dayConsolidatedIngredients,
          data.ingredient,
          data.quantity,
        );
      }
    }

    // 3. JIT Logic and Stock Check
    const purchaseRequests: { ingredient: Ingredient; quantity: number }[] = [];

    for (const [ingredientId, data] of dayConsolidatedIngredients.entries()) {
      const { quantity: totalRequiredQuantity, ingredient } = data;

      const currentIngredient: Ingredient =
        await TenantAwareRepository.findOneByTenant(
          this.ingredientRepository,
          ingredient.id,
          companyId,
          { relations: { lots: true } },
        );

      let quantityInStock = 0;
      if (currentIngredient?.lots) {
        quantityInStock = currentIngredient.lots.reduce(
          (sum, lot) => sum + lot.quantity,
          0,
        );
      }

      if (
        currentIngredient.isFresh &&
        totalRequiredQuantity > quantityInStock
      ) {
        purchaseRequests.push({
          ingredient: currentIngredient,
          quantity: totalRequiredQuantity - quantityInStock,
        });
        this.logger.warn(
          `JIT: Company ${companyId} needs to purchase ${totalRequiredQuantity - quantityInStock} of fresh ingredient ${currentIngredient.name}.`,
        );
      }
    }

    // 5. Create draft Purchase Orders
    if (purchaseRequests.length > 0) {
      const defaultSupplier = await TenantAwareRepository.findAllByTenant(
        this.supplierRepository,
        companyId,
        { take: 1 },
      );

      if (defaultSupplier.length === 0) {
        this.logger.warn(
          `No supplier found for company ${companyId}. Skipping creation of JIT purchase orders.`,
        );
      } else {
        const purchaseOrder = this.purchaseOrderRepository.create({
          companyId,
          orderDate: new Date(),
          status: PurchaseOrderStatus.PENDING,
          supplier: defaultSupplier[0],
          items: purchaseRequests.map((req) =>
            this.purchaseOrderItemRepository.create({
              ingredient: req.ingredient,
              quantity: req.quantity,
            }),
          ),
        });
        await this.purchaseOrderRepository.save(purchaseOrder);
        this.logger.log(
          `JIT Purchase Order (ID: ${purchaseOrder.id}) created for company ${companyId} with ${purchaseRequests.length} items.`,
        );
      }
    }

    this.logger.log(
      `Production details processing completed for company ${companyId} on ${targetDate}.`,
    );
  }

  public async syncPickingListForShift(
    companyId: number,
    targetDate: string,
    shiftId: number,
    cachedMealShifts?: MealShift[],
    cachedReservations?: Reservation[],
  ): Promise<Map<number, { quantity: number; ingredient: Ingredient }>> {
    const consolidatedIngredients = new Map<
      number,
      { quantity: number; ingredient: Ingredient }
    >();

    // 1. Filter data for this specific shift
    const msForShift = (cachedMealShifts || []).filter(
      (ms) => ms.shiftId === shiftId,
    );
    const resForShift = (cachedReservations || []).filter(
      (res) => res.timeslot.shiftId === shiftId,
    );

    // If no cache provided, fetch them (for real-time individual sync)
    if (!cachedMealShifts && !cachedReservations) {
      const allMs = await TenantAwareRepository.findAllByTenant(
        this.mealShiftRepository,
        companyId,
        {
          relations: { menuItem: { recipeIngredients: { ingredient: true } } },
        },
      );
      msForShift.push(
        ...allMs.filter(
          (ms) =>
            ms.shiftId === shiftId &&
            this.isMealShiftActiveForDate(ms, new Date(targetDate)) &&
            ms.quantityProduced > 0,
        ),
      );

      const allRes = await TenantAwareRepository.findAllByTenant(
        this.reservationRepository,
        companyId,
        {
          where: {
            status: ReservationStatus.CONFIRMED,
            timeslot: { shiftId },
            menuOption: { menuDay: { date: targetDate as any } },
          },
          relations: {
            timeslot: true,
            menuOption: {
              menuItem: { recipeIngredients: { ingredient: true } },
            },
          },
        },
      );
      resForShift.push(...allRes);
    }

    // 2. Consolidate MealShifts
    for (const ms of msForShift) {
      for (const ri of ms.menuItem.recipeIngredients) {
        this.addIngredientToConsolidation(
          consolidatedIngredients,
          ri.ingredient,
          ri.quantity * ms.quantityProduced,
        );
      }
    }

    // 3. Consolidate Reservations
    for (const res of resForShift) {
      const menuItem = res.menuOption?.menuItem;
      if (!menuItem?.recipeIngredients) continue;
      for (const ri of menuItem.recipeIngredients) {
        this.addIngredientToConsolidation(
          consolidatedIngredients,
          ri.ingredient,
          ri.quantity,
        );
      }
    }

    // 4. Find or Create PickingList for this Shift
    let pickingList = await this.pickingListRepository.findOne({
      where: { companyId, date: targetDate as any, shiftId },
      relations: { items: true },
    });

    if (consolidatedIngredients.size === 0) {
      if (pickingList) await this.pickingListRepository.remove(pickingList);
      return consolidatedIngredients;
    }

    if (!pickingList) {
      pickingList = this.pickingListRepository.create({
        companyId,
        date: targetDate as any,
        shiftId,
        status: PickingListStatus.PENDING,
        items: [],
      });
    }

    // 5. Update Items
    const newItems: PickingListItem[] = [];
    for (const [ingredientId, data] of consolidatedIngredients.entries()) {
      let item = pickingList.items?.find(
        (i) => i.ingredientId === ingredientId,
      );
      if (item) {
        item.requiredQuantity = data.quantity;
      } else {
        item = this.pickingListItemRepository.create({
          ingredient: data.ingredient,
          requiredQuantity: data.quantity,
        });
      }
      newItems.push(item);
    }
    pickingList.items = newItems;

    await this.pickingListRepository.save(pickingList);
    this.logger.log(
      `Synced PickingList for company ${companyId}, date ${targetDate}, shift ${shiftId}`,
    );

    return consolidatedIngredients;
  }

  async getPickingListByDate(
    companyId: number,
    date: string,
  ): Promise<PickingList> {
    // Ensure we are comparing just the date part if it comes as ISO
    const dateOnly = date.includes('T') ? date.split('T')[0] : date;

    const pickingList = await TenantAwareRepository.createTenantQueryBuilder(
      this.pickingListRepository,
      companyId,
      'pickingList',
    )
      .where('pickingList.date = :date', { date: dateOnly })
      .leftJoinAndSelect('pickingList.items', 'items')
      .leftJoinAndSelect('items.ingredient', 'ingredient')
      .getOne();

    if (!pickingList) {
      this.logger.warn(`PickingList not found for company ${companyId} and date ${dateOnly}`);
      throw new NotFoundException(
        `PickingList for date ${dateOnly} not found for company ${companyId}.`,
      );
    }
    return pickingList;
  }

  async handleProductionPlanManual(
    companyId: number,
    date: string,
  ): Promise<void> {
    this.logger.log(
      `Manually triggering production plan for company ${companyId} on ${date}.`,
    );
    // Here we reuse the existing private method for processing,
    // ensuring consistency whether it's cron-triggered or manual.
    await this._processProductionForCompany(companyId, date);
    this.logger.log(
      `Manual production plan for company ${companyId} on ${date} completed.`,
    );
  }

  async updatePickedQuantity(
    companyId: number,
    itemId: number,
    updateDto: UpdatePickedQuantityDto,
  ): Promise<PickingListItem> {
    const item = await this.pickingListItemRepository.findOne({
      where: { id: itemId, pickingList: { companyId } },
      relations: { pickingList: true },
    });

    if (!item) {
      throw new NotFoundException(`PickingListItem with ID ${itemId} not found`);
    }

    if (item.pickingList.status === PickingListStatus.COMPLETED) {
      throw new BadRequestException('Cannot update a completed picking list');
    }

    item.pickedQuantity = updateDto.pickedQuantity;

    // Update parent status if it was PENDING
    if (item.pickingList.status === PickingListStatus.PENDING) {
      item.pickingList.status = PickingListStatus.IN_PROGRESS;
      await this.pickingListRepository.save(item.pickingList);
    }

    return this.pickingListItemRepository.save(item);
  }

  async finalizePickingList(
    companyId: number,
    id: number,
    user: User,
  ): Promise<PickingList> {
    const list = await this.pickingListRepository.findOne({
      where: { id, companyId },
      relations: { items: { ingredient: true } },
    });

    if (!list) {
      throw new NotFoundException(`PickingList with ID ${id} not found`);
    }

    if (list.status === PickingListStatus.COMPLETED) {
      return list;
    }

    // 1. Deduct Stock (Option B)
    await this.deductStockForPickingList(list, user);

    // 2. Mark as COMPLETED
    list.status = PickingListStatus.COMPLETED;
    return this.pickingListRepository.save(list);
  }

  private async deductStockForPickingList(list: PickingList, user: User) {
    for (const item of list.items) {
      if (item.pickedQuantity <= 0) continue;

      // Atomic decrement of ingredient stock
      await this.ingredientRepository.decrement(
        { id: item.ingredientId },
        'quantityInStock',
        item.pickedQuantity,
      );

      // Create Stock Movement record
      const movement = this.stockMovementRepository.create({
        ingredient: item.ingredient,
        quantity: item.pickedQuantity,
        unit: item.ingredient.unit,
        movementType: MovementType.OUT,
        reason: 'production',
        relatedTicketId: `PICK-${list.id}`, // Traceability back to the picking list
        performedBy: user,
        companyId: list.companyId,
      });

      await this.stockMovementRepository.save(movement);
    }
    this.logger.log(
      `Stock deducted for PickingList ${list.id} (Company ${list.companyId})`,
    );
  }

  private addIngredientToConsolidation(
    consolidatedIngredients: Map<
      number,
      { quantity: number; ingredient: Ingredient }
    >,
    ingredient: Ingredient,
    quantity: number,
  ) {
    if (consolidatedIngredients.has(ingredient.id)) {
      consolidatedIngredients.get(ingredient.id).quantity += quantity;
    } else {
      consolidatedIngredients.set(ingredient.id, {
        quantity,
        ingredient,
      });
    }
  }
}
