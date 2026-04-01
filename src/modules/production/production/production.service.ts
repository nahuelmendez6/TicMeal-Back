import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { TenantAwareRepository } from 'src/common/repository/tenant-aware.repository';
import {
  Booking,
  BookingStatus,
} from 'src/modules/bookings/entities/booking.entity';
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

@Injectable()
export class ProductionService {
  private readonly logger = new Logger(ProductionService.name);

  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
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
    private readonly pickingListItemRepository: Repository<PickingListItem>, // PickingListItem doesn't extend BaseTenantEntity directly, its parent PickingList does
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
  ) {
    this.logger.log(
      `Processing production details for company ${companyId} on ${targetDate}...`,
    );

    // 1. Fetch all MealShifts for the company
    const allMealShifts: MealShift[] = await TenantAwareRepository.findAllByTenant(
      this.mealShiftRepository,
      companyId,
      {
        relations: {
          menuItem: {
            recipeIngredients: {
              ingredient: true,
            },
            lots: true,
          },
        },
      },
    );

    // Filter MealShifts that are active for the target date and have quantityProduced > 0
    const activeMealShifts = allMealShifts.filter(
      (mealShift) =>
        this.isMealShiftActiveForDate(mealShift, new Date(targetDate)) &&
        mealShift.quantityProduced > 0,
    );

    if (activeMealShifts.length === 0) {
      this.logger.log(
        `No active MealShifts with production for company ${companyId} on ${targetDate}.`,
      );
      return;
    }

    const consolidatedIngredients = new Map<
      number,
      { quantity: number; ingredient: Ingredient }
    >();

    // 2. BOM Explosion: Calculate total required quantity for each ingredient
    for (const mealShift of activeMealShifts) {
      if (mealShift.quantityProduced <= 0) continue; // Only process if there's production

      for (const recipeIngredient of mealShift.menuItem.recipeIngredients) {
        const requiredForOneMenuItem = recipeIngredient.quantity; // Quantity needed per menu item
        const totalRequired =
          requiredForOneMenuItem * mealShift.quantityProduced; // Total needed for all produced items

        if (consolidatedIngredients.has(recipeIngredient.ingredient.id)) {
          consolidatedIngredients.get(
            recipeIngredient.ingredient.id,
          ).quantity += totalRequired;
        } else {
          consolidatedIngredients.set(recipeIngredient.ingredient.id, {
            quantity: totalRequired,
            ingredient: recipeIngredient.ingredient,
          });
        }
      }
    }

    // 3. JIT Logic and Stock Check
    const pickingListItems: PickingListItem[] = [];
    const purchaseRequests: { ingredient: Ingredient; quantity: number }[] = [];

    for (const [ingredientId, data] of consolidatedIngredients.entries()) {
      const { quantity: totalRequiredQuantity, ingredient } = data;

      // Fetch the ingredient again to get its current stock (assuming it's a computed property from lots)
      // For simplicity, we'll assume `ingredient.lots` are loaded and can be used to calculate `quantityInStock`
      // In a real scenario, you might have a dedicated stock service or computed property for this.
      const currentIngredient: Ingredient =
        await TenantAwareRepository.findOneByTenant(
          this.ingredientRepository,
          ingredient.id,
          companyId,
          {
            relations: { lots: true }, // To compute quantityInStock
          },
        );

      let quantityInStock = 0;
      if (currentIngredient && currentIngredient.lots) {
        quantityInStock = currentIngredient.lots.reduce(
          (sum, lot) => sum + lot.quantity,
          0,
        );
      }

      const neededForPicking = Math.max(0, totalRequiredQuantity); // Only pick if > 0

      // Add to picking list regardless of JIT for now
      if (neededForPicking > 0) {
        const pickingItem = this.pickingListItemRepository.create({
          ingredient: currentIngredient,
          requiredQuantity: neededForPicking,
        });
        pickingListItems.push(pickingItem);
      }

      if (
        currentIngredient.isFresh &&
        totalRequiredQuantity > quantityInStock
      ) {
        const quantityToPurchase = totalRequiredQuantity - quantityInStock;
        purchaseRequests.push({
          ingredient: currentIngredient, // Pass the full ingredient object
          quantity: quantityToPurchase,
        });
        this.logger.warn(
          `JIT: Company ${companyId} needs to purchase ${quantityToPurchase} of fresh ingredient ${currentIngredient.name}.`,
        );
      }
    }

    // 4. Generate PickingList
    if (pickingListItems.length > 0) {
      const pickingList = this.pickingListRepository.create({
        companyId,
        date: new Date(targetDate),
        status: PickingListStatus.PENDING,
        items: pickingListItems,
      });
      await this.pickingListRepository.save(pickingList);
      this.logger.log(
        `Picking List created for company ${companyId} on ${targetDate} with ${pickingListItems.length} items.`,
      );
    } else {
      this.logger.log(
        `No picking list generated for company ${companyId} on ${targetDate} as no ingredients are required.`,
      );
    }

    // 5. Create draft Purchase Orders
    if (purchaseRequests.length > 0) {
      const defaultSupplier = await TenantAwareRepository.findAllByTenant(this.supplierRepository, companyId, { take: 1 });

      if (defaultSupplier.length === 0) {
        this.logger.warn(`No supplier found for company ${companyId}. Skipping creation of JIT purchase orders.`);
      } else {
        const purchaseOrder = this.purchaseOrderRepository.create({
          companyId,
          orderDate: new Date(),
          status: PurchaseOrderStatus.PENDING, // DRAFT is also an option, but PENDING seems more appropriate for JIT
          supplier: defaultSupplier[0],
          items: purchaseRequests.map(req => this.purchaseOrderItemRepository.create({
            ingredient: req.ingredient, // Pass the full ingredient object
            quantity: req.quantity,
          })),
        });
        await this.purchaseOrderRepository.save(purchaseOrder);
        this.logger.log(`JIT Purchase Order (ID: ${purchaseOrder.id}) created for company ${companyId} with ${purchaseRequests.length} items.`);
      }
    }

    this.logger.log(
      `Production details processing completed for company ${companyId} on ${targetDate}.`,
    );
  }

  async getPickingListByDate(
    companyId: number,
    date: string,
  ): Promise<PickingList> {
    const pickingList = await TenantAwareRepository.createTenantQueryBuilder(
      this.pickingListRepository,
      companyId,
      'pickingList',
    )
      .where('pickingList.date = :date', { date: new Date(date) })
      .leftJoinAndSelect('pickingList.items', 'items')
      .leftJoinAndSelect('items.ingredient', 'ingredient')
      .getOne();

    if (!pickingList) {
      throw new NotFoundException(
        `PickingList for date ${date} not found for company ${companyId}.`,
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
}
