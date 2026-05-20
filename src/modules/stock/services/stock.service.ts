import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, QueryRunner } from 'typeorm';
import { StockMovement } from '../entities/stock-movement.entity';
import { Ingredient } from '../entities/ingredient.entity';
import { MenuItems } from '../entities/menu-items.entity';
import { MovementType } from '../enums/enums';
import { CreateStockMovementDto } from '../dto/create-stock-movement.dto';
import { User } from 'src/modules/users/entities/user.entity';
import { IngredientLot } from '../entities/ingredient-lot.entity';
import { MenuItemLot } from '../entities/menu-item-lot.entity';
import { CreateStockAuditDto } from '../dto/create-stock-audit.dto';
import { StockAudit } from '../entities/stock-audit.entity';
import { StockAuditType } from '../enums/stock-audit-type.enum';

@Injectable()
export class StockService {
  constructor(
    @InjectRepository(StockMovement)
    private readonly stockMovementRepo: Repository<StockMovement>,
    @InjectRepository(Ingredient)
    private readonly ingredientRepo: Repository<Ingredient>,
    @InjectRepository(IngredientLot)
    private readonly ingredientLotRepo: Repository<IngredientLot>,
    @InjectRepository(MenuItemLot)
    private readonly menuItemLotRepo: Repository<MenuItemLot>,
    private readonly dataSource: DataSource,
  ) {}

  async handleAudit(
    auditData: CreateStockAuditDto,
    companyId: number,
    userId: number,
  ): Promise<StockAudit> {
    const { auditType, ingredientId, menuItemId, physicalStock, observations } =
      auditData;

    if (auditType === StockAuditType.INGREDIENT && !ingredientId) {
      throw new BadRequestException(
        'ingredientId es requerido para auditorías de INGREDIENT.',
      );
    }
    if (auditType === StockAuditType.MENU_ITEM && !menuItemId) {
      throw new BadRequestException(
        'menuItemId es requerido para auditorías de MENU_ITEM.',
      );
    }
    if (ingredientId && menuItemId) {
      throw new BadRequestException(
        'No puede proporcionar ingredientId y menuItemId simultáneamente.',
      );
    }

    return this.dataSource.transaction(async (manager) => {
      let theoreticalStock = 0;
      let unitCostAtAudit = 0;
      let entity: Ingredient | MenuItems;
      let lots: (IngredientLot | MenuItemLot)[];
      let lastLot: IngredientLot | MenuItemLot;

      if (auditType === StockAuditType.INGREDIENT) {
        entity = await manager.findOneBy(Ingredient, {
          id: ingredientId,
          companyId,
        });
        if (!entity) {
          throw new NotFoundException('Ingrediente no encontrado.');
        }
        lots = await manager.find(IngredientLot, {
          where: { ingredient: { id: ingredientId }, companyId },
        });
        theoreticalStock = lots.reduce((sum, lot) => sum + lot.quantity, 0);
        lastLot = lots.sort((a, b) => b.id - a.id)[0];
        unitCostAtAudit = lastLot ? lastLot.unitCost : 0;
      } else {
        // StockAuditType.MENU_ITEM
        entity = await manager.findOneBy(MenuItems, {
          id: menuItemId,
          companyId,
        });
        if (!entity) {
          throw new NotFoundException('Ítem de menú no encontrado.');
        }
        lots = await manager.find(MenuItemLot, {
          where: { menuItem: { id: menuItemId }, companyId },
        });
        theoreticalStock = lots.reduce((sum, lot) => sum + lot.quantity, 0);
        lastLot = lots.sort((a, b) => b.id - a.id)[0];
        unitCostAtAudit = lastLot ? lastLot.unitCost : 0;
      }

      const difference = theoreticalStock - physicalStock;

      const audit = manager.create(StockAudit, {
        auditType,
        ingredientId:
          auditType === StockAuditType.INGREDIENT ? ingredientId : null,
        menuItemId: auditType === StockAuditType.MENU_ITEM ? menuItemId : null,
        companyId,
        physicalStock,
        theoreticalStock,
        difference,
        unitCostAtAudit,
        observations,
        auditDate: new Date(),
      });
      const savedAudit = await manager.save(audit);

      if (difference > 0) {
        // Shortage
        let amountToDecrease = difference;
        const sortedLots = lots
          .filter((l) => l.quantity > 0)
          .sort((a, b) => a.id - b.id); // FIFO

        for (const lot of sortedLots) {
          if (amountToDecrease <= 0) break;
          const amountFromLot = Math.min(lot.quantity, amountToDecrease);

          const movementDto: CreateStockMovementDto = {
            ingredientId:
              auditType === StockAuditType.INGREDIENT ? ingredientId : null,
            menuItemId:
              auditType === StockAuditType.MENU_ITEM ? menuItemId : null,
            ingredientLotId:
              auditType === StockAuditType.INGREDIENT
                ? (lot as IngredientLot).id
                : null,
            menuItemLotId:
              auditType === StockAuditType.MENU_ITEM
                ? (lot as MenuItemLot).id
                : null,
            quantity: amountFromLot,
            movementType: MovementType.OUT,
            reason: `Ajuste por auditoría #${savedAudit.id}`,
            auditId: savedAudit.id,
          };
          await this.registerMovement(
            movementDto,
            companyId,
            userId,
            manager.queryRunner,
          );
          amountToDecrease -= amountFromLot;
        }
      } else if (difference < 0) {
        // Surplus
        const amountToIncrease = Math.abs(difference);
        if (lastLot) {
          const movementDto: CreateStockMovementDto = {
            ingredientId:
              auditType === StockAuditType.INGREDIENT ? ingredientId : null,
            menuItemId:
              auditType === StockAuditType.MENU_ITEM ? menuItemId : null,
            lotNumber: lastLot.lotNumber,
            quantity: amountToIncrease,
            movementType: MovementType.IN,
            reason: `Ajuste por auditoría #${savedAudit.id}`,
            unitCost: lastLot.unitCost,
            auditId: savedAudit.id,
          };
          await this.registerMovement(
            movementDto,
            companyId,
            userId,
            manager.queryRunner,
          );
        }
      }

      return savedAudit;
    });
  }

  async findHistoryForIngredient(
    ingredientId: number,
    companyId: number,
  ): Promise<StockMovement[]> {
    return this.stockMovementRepo.find({
      where: { ingredient: { id: ingredientId }, companyId },
      order: { createdAt: 'DESC' as const },
      relations: ['performedBy', 'ingredientLot'],
    });
  }

  async findHistoryForMenuItem(
    menuItemId: number,
    companyId: number,
  ): Promise<StockMovement[]> {
    return this.stockMovementRepo.find({
      where: { menuItem: { id: menuItemId }, companyId },
      order: { createdAt: 'DESC' as const },
      relations: ['performedBy', 'menuItemLot'],
    });
  }

  async calculateTrueStock(
    ingredientId: number,
    companyId: number,
  ): Promise<number> {
    const lots = await this.ingredientLotRepo.find({
      where: { ingredient: { id: ingredientId }, companyId },
    });
    return lots.reduce((sum, lot) => sum + lot.quantity, 0);
  }

  async deductStockFIFO(
    ingredientId: number,
    quantity: number,
    companyId: number,
    userId: number,
    reason: string,
    relatedTicketId?: string,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const ingredient = await manager.findOneBy(Ingredient, {
        id: ingredientId,
        companyId,
      });
      if (!ingredient) throw new NotFoundException('Ingrediente no encontrado.');

      const lots = await manager.find(IngredientLot, {
        where: { ingredient: { id: ingredientId }, companyId },
      });

      const activeLots = lots
        .filter((l) => l.quantity > 0)
        .sort((a, b) => a.id - b.id); // FIFO: oldest lot (smallest ID) first

      let remainingToDeduct = quantity;

      for (const lot of activeLots) {
        if (remainingToDeduct <= 0) break;

        const amountFromLot = Math.min(lot.quantity, remainingToDeduct);
        lot.quantity -= amountFromLot;
        await manager.save(lot);

        const movement = manager.create(StockMovement, {
          ingredient,
          ingredientLot: lot,
          quantity: amountFromLot,
          movementType: MovementType.OUT,
          reason,
          relatedTicketId,
          performedBy: { id: userId } as User,
          companyId,
          unit: ingredient.unit,
          stockAfter: lot.quantity,
        });
        await manager.save(movement);

        remainingToDeduct -= amountFromLot;
      }

      if (remainingToDeduct > 0) {
        // This should probably be handled by the caller checking stock before calling this,
        // but as a fallback/safety measure:
        throw new BadRequestException(
          `Stock insuficiente para el ingrediente ${ingredient.name}. Faltante: ${remainingToDeduct}`,
        );
      }
    });
  }

  async registerMovement(
    createDto: CreateStockMovementDto,
    companyId: number,
    userId: number,
    queryRunner?: QueryRunner,
  ): Promise<StockMovement> {
    const runner = queryRunner || this.dataSource.createQueryRunner();

    if (!queryRunner) {
      await runner.connect();
      await runner.startTransaction();
    }

    try {
      const { menuItemId, ingredientId, movementType } = createDto;

      if (!menuItemId && !ingredientId) {
        throw new BadRequestException(
          'Debe proporcionar un menuItemId o un ingredientId.',
        );
      }
      if (menuItemId && ingredientId) {
        throw new BadRequestException(
          'No puede proporcionar menuItemId e ingredientId simultáneamente.',
        );
      }

      let savedMovement: StockMovement;

      if (movementType === MovementType.IN) {
        savedMovement = await this.handleInMovement(
          runner,
          createDto,
          companyId,
          userId,
        );
      } else if (movementType === MovementType.OUT) {
        savedMovement = await this.handleOutMovement(
          runner,
          createDto,
          companyId,
          userId,
        );
      } else {
        throw new BadRequestException('Tipo de movimiento no válido.');
      }

      if (!queryRunner) {
        await runner.commitTransaction();
      }

      return savedMovement;
    } catch (err) {
      if (!queryRunner) {
        await runner.rollbackTransaction();
      }
      throw err;
    } finally {
      if (!queryRunner) {
        await runner.release();
      }
    }
  }

  private async handleInMovement(
    runner: QueryRunner,
    createDto: CreateStockMovementDto,
    companyId: number,
    userId: number,
  ): Promise<StockMovement> {
    const { ingredientId, menuItemId, quantity, unitCost, expirationDate } =
      createDto;

    if (ingredientId) {
      if (createDto.lotNumber === undefined || unitCost === undefined) {
        throw new BadRequestException(
          'Para movimientos de ENTRADA de ingredientes, se requiere lotNumber y unitCost.',
        );
      }
    } else if (menuItemId) {
      if (unitCost === undefined) {
        throw new BadRequestException(
          'Para movimientos de ENTRADA de ítems de menú, se requiere unitCost.',
        );
      }
      if (createDto.reason === 'Producción') {
        if (createDto.lotNumber === undefined) {
          createDto.lotNumber = `PROD-${new Date().toISOString().replace(/[:.-]/g, '')}`;
        }
      } else if (createDto.lotNumber === undefined) {
        throw new BadRequestException(
          'Para movimientos de ENTRADA de ítems de menú (no producción), se requiere lotNumber.',
        );
      }
    }

    let lot: IngredientLot | MenuItemLot;
    const user = { id: userId } as User;

    if (ingredientId) {
      const ingredientRepo = runner.manager.getRepository(Ingredient);
      const ingredient = await ingredientRepo.findOneBy({
        id: ingredientId,
        companyId,
      });
      if (!ingredient)
        throw new NotFoundException('Ingrediente no encontrado.');

      const lotRepo = runner.manager.getRepository(IngredientLot);
      const existingLot = await lotRepo.findOne({
        where: {
          lotNumber: createDto.lotNumber,
          ingredient: { id: ingredientId },
          companyId,
        },
      });

      if (existingLot) {
        existingLot.quantity += quantity;
        if (createDto.movementType === MovementType.IN) {
          existingLot.unitCost = unitCost;
        }
        lot = await runner.manager.save(existingLot);
      } else {
        const newLot = lotRepo.create({
          ingredient,
          lotNumber: createDto.lotNumber,
          quantity,
          unitCost,
          expirationDate: expirationDate ? new Date(expirationDate) : null,
          companyId,
        });
        lot = await runner.manager.save(newLot);
      }

      const movement = runner.manager.create(StockMovement, {
        ...createDto,
        companyId,
        performedBy: user,
        ingredient,
        ingredientLot: lot,
        stockAfter: lot.quantity,
        unit: ingredient.unit,
      });
      return runner.manager.save(movement);
    } else {
      // Lógica para menuItemId
      const menuItemRepo = runner.manager.getRepository(MenuItems);
      const menuItem = await menuItemRepo.findOneBy({
        id: menuItemId,
        companyId,
      });
      if (!menuItem) throw new NotFoundException('Ítem de menú no encontrado.');

      const lotRepo = runner.manager.getRepository(MenuItemLot);
      const existingLot = await lotRepo.findOne({
        where: {
          lotNumber: createDto.lotNumber,
          menuItem: { id: menuItemId },
          companyId,
        },
      });

      if (existingLot) {
        existingLot.quantity += quantity;
        if (createDto.movementType === MovementType.IN) {
          existingLot.unitCost = unitCost;
        }
        lot = await runner.manager.save(existingLot);
      } else {
        const newLot = lotRepo.create({
          menuItem,
          lotNumber: createDto.lotNumber,
          quantity,
          unitCost,
          expirationDate: expirationDate ? new Date(expirationDate) : null,
          companyId,
        });
        lot = await runner.manager.save(newLot);
      }

      const movement = runner.manager.create(StockMovement, {
        ...createDto,
        companyId,
        performedBy: user,
        menuItem,
        menuItemLot: lot,
        stockAfter: lot.quantity,
        unit: 'unit' as any,
      });
      return runner.manager.save(movement);
    }
  }

  private async handleOutMovement(
    runner: QueryRunner,
    createDto: CreateStockMovementDto,
    companyId: number,
    userId: number,
  ): Promise<StockMovement> {
    const {
      quantity,
      ingredientId,
      menuItemId,
      ingredientLotId,
      menuItemLotId,
    } = createDto;

    if (!ingredientLotId && !menuItemLotId) {
      throw new BadRequestException(
        'Para movimientos de SALIDA, se requiere ingredientLotId o menuItemLotId.',
      );
    }

    let lot: IngredientLot | MenuItemLot;
    const user = { id: userId } as User;

    if (ingredientLotId) {
      if (!ingredientId)
        throw new BadRequestException(
          'Se proporcionó ingredientLotId pero no ingredientId.',
        );
      const lotRepo = runner.manager.getRepository(IngredientLot);
      lot = await lotRepo.findOne({
        where: { id: ingredientLotId, companyId },
        relations: ['ingredient'],
      });
      if (!lot)
        throw new NotFoundException('Lote de ingrediente no encontrado.');
      if (lot.ingredient.id !== ingredientId)
        throw new BadRequestException(
          'El lote no corresponde al ingrediente especificado.',
        );
    } else {
      // Lógica para menuItemLotId
      if (!menuItemId)
        throw new BadRequestException(
          'Se proporcionó menuItemLotId pero no menuItemId.',
        );
      const lotRepo = runner.manager.getRepository(MenuItemLot);
      lot = await lotRepo.findOne({
        where: { id: menuItemLotId, companyId },
        relations: ['menuItem'],
      });
      if (!lot)
        throw new NotFoundException('Lote de ítem de menú no encontrado.');
      if (lot.menuItem.id !== menuItemId)
        throw new BadRequestException(
          'El lote no corresponde al ítem de menú especificado.',
        );
    }

    if (lot.quantity < quantity) {
      throw new BadRequestException(
        `Stock insuficiente en el lote. Disponible: ${lot.quantity}, Requerido: ${quantity}`,
      );
    }

    lot.quantity -= quantity;
    await runner.manager.save(lot);

    const movement = runner.manager.create(StockMovement, {
      ...createDto,
      companyId,
      performedBy: user,
      ingredient: ingredientId ? ({ id: ingredientId } as Ingredient) : null,
      menuItem: menuItemId ? ({ id: menuItemId } as MenuItems) : null,
      ingredientLot: ingredientLotId ? (lot as IngredientLot) : null,
      menuItemLot: menuItemLotId ? (lot as MenuItemLot) : null,
      stockAfter: lot.quantity,
      unit:
        'ingredient' in lot ? (lot as any).ingredient.unit : ('unit' as any),
    });

    return runner.manager.save(movement);
  }
}
