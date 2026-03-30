import {
  Injectable,
  NotFoundException,
  Logger,
  Inject,
  forwardRef,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Raw, MoreThan } from 'typeorm';
import { IngredientLot } from '../entities/ingredient-lot.entity';
import { MealShift } from '../entities/meal-shift.entity';
import { CreateMealShiftDto } from '../dto/create-meal-shift.dto';
import { UpdateMealShiftDto } from '../dto/update-meal-shift.dto';
import { MenuItems } from '../entities/menu-items.entity';
import { MovementType } from '../enums/enums';
import { StockService } from './stock.service';
import { CostingService } from 'src/modules/costing/services/costing.service';

@Injectable()
export class MealShiftService {
  private readonly logger = new Logger(MealShiftService.name);

  constructor(
    @InjectRepository(MealShift)
    private readonly mealShiftRepository: Repository<MealShift>,
    private readonly stockService: StockService,
    @Inject(forwardRef(() => CostingService))
    private readonly costingService: CostingService,
    private readonly dataSource: DataSource,
  ) {}

  async create(
    createMealShiftDto: CreateMealShiftDto,
    companyId: number,
    userId?: number,
  ): Promise<MealShift> {
    const { menuItemId, quantityProduced } = createMealShiftDto;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const menuItem = await queryRunner.manager.findOne(MenuItems, {
        where: { id: menuItemId, companyId },
        relations: ['recipeIngredients', 'recipeIngredients.ingredient'],
      });

      if (!menuItem) {
        throw new NotFoundException(
          `Menu Item with ID ${menuItemId} not found`,
        );
      }

      const mealShift = queryRunner.manager.create(MealShift, {
        ...createMealShiftDto,
        date: new Date(createMealShiftDto.date).toISOString().split('T')[0],
        companyId,
        quantityAvailable:
          createMealShiftDto.quantityAvailable ?? quantityProduced,
      });
      const savedMealShift = await queryRunner.manager.save(mealShift);

      // Calculate production cost
      const productionCost = await this.costingService.calculateMenuItemCost(
        menuItem.id,
        companyId,
      );

      // Register stock movement for the produced MenuItem (IN)
      await this.stockService.registerMovement(
        {
          menuItemId: menuItem.id,
          quantity: quantityProduced,
          movementType: MovementType.IN,
          reason: 'Producción',
          unitCost: productionCost, // Cost per unit
        },
        companyId,
        userId,
        queryRunner,
      );

      // Register stock movements for the consumed ingredients (OUT)
      if (menuItem.recipeIngredients && menuItem.recipeIngredients.length > 0) {
        for (const recipeIngredient of menuItem.recipeIngredients) {
          const ingredient = recipeIngredient.ingredient;
          const netQuantityPerUnit = recipeIngredient.quantity;
          const shrinkage = ingredient.shrinkagePercentage || 0;

          // Calcular la cantidad bruta necesaria para obtener la neta
          const grossQuantityPerUnit =
            netQuantityPerUnit / (1 - shrinkage / 100);
          let remainingQuantityToConsume =
            grossQuantityPerUnit * quantityProduced;

          if (remainingQuantityToConsume <= 0) {
            continue; // Skip if no quantity to consume
          }

          // Fetch available IngredientLots for the current ingredient, ordered by ID (FIFO)
          const ingredientLots = await queryRunner.manager.find(IngredientLot, {
            where: {
              ingredient: { id: ingredient.id },
              companyId,
              quantity: MoreThan(0), // Only consider lots with available stock
            },
            order: { id: 'ASC' }, // FIFO: consume oldest lots first
          });

          if (ingredientLots.length === 0) {
            throw new BadRequestException(
              `Stock insuficiente para el ingrediente: ${ingredient.name}. No hay lotes disponibles.`,
            );
          }

          for (const lot of ingredientLots) {
            if (remainingQuantityToConsume <= 0) break;

            const amountToConsumeFromLot = Math.min(
              remainingQuantityToConsume,
              lot.quantity,
            );

            await this.stockService.registerMovement(
              {
                ingredientId: ingredient.id,
                ingredientLotId: lot.id, // Pass the specific lot ID
                quantity: amountToConsumeFromLot,
                movementType: MovementType.OUT,
                reason: `Producción de ${menuItem.name}`,
              },
              companyId,
              userId,
              queryRunner,
            );

            remainingQuantityToConsume -= amountToConsumeFromLot;
          }

          if (remainingQuantityToConsume > 0) {
            // This means we ran out of stock before consuming the full quantity
            throw new BadRequestException(
              `Stock insuficiente para el ingrediente: ${ingredient.name}. Faltan ${remainingQuantityToConsume.toFixed(2)} unidades.`,
            );
          }
        }
      }

      await queryRunner.commitTransaction();
      return savedMealShift;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(companyId: number): Promise<MealShift[]> {
    return await this.mealShiftRepository.find({
      where: { companyId },
      relations: ['shift', 'menuItem'],
      order: { date: 'DESC' },
    });
  }

  async findOne(id: number, companyId: number): Promise<MealShift> {
    const mealShift = await this.mealShiftRepository.findOne({
      where: { id, companyId },
      relations: ['shift', 'menuItem'],
    });

    if (!mealShift) {
      throw new NotFoundException(`MealShift with ID ${id} not found`);
    }

    return mealShift;
  }

  async update(
    id: number,
    updateMealShiftDto: UpdateMealShiftDto,
    companyId: number,
  ): Promise<MealShift> {
    const mealShift = await this.findOne(id, companyId);
    const updated = this.mealShiftRepository.merge(
      mealShift,
      updateMealShiftDto,
    );
    return await this.mealShiftRepository.save(updated);
  }

  async remove(id: number, companyId: number): Promise<void> {
    const mealShift = await this.findOne(id, companyId);
    await this.mealShiftRepository.remove(mealShift);
  }

  async isMenuItemProducedForShift(
    menuItemId: number,
    shiftId: number,
    date: Date,
    companyId: number,
  ): Promise<boolean> {
    this.logger.log(
      `Checking production for menuItemId: ${menuItemId}, shiftId: ${shiftId}, date: ${date.toISOString()}, companyId: ${companyId}`,
    );

    const dateString = date.toISOString().split('T')[0];

    const mealShift = await this.mealShiftRepository.findOne({
      where: {
        menuItemId,
        shiftId,
        companyId,
        date: Raw((alias) => `${alias} = :date`, { date: dateString }),
      },
    });

    const result = mealShift && mealShift.quantityProduced > 0;
    this.logger.log(`Production check result: ${result}`);

    return result;
  }
}
