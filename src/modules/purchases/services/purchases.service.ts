import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, In } from 'typeorm';
import { PurchaseOrder } from '../entities/purchase-order.entity';
import { CreatePurchaseOrderDto } from '../dto/create-purchase-order.dto';
import { PurchaseOrderStatus } from '../enums/purchase-order-status.enum';
import { StockService } from 'src/modules/stock/services/stock.service';
import { MovementType } from 'src/modules/stock/enums/enums';
import { IngredientService } from 'src/modules/stock/services/ingredient.service';
import { MenuItemService } from 'src/modules/stock/services/menu-item.service';
import { SuppliersService } from 'src/modules/suppliers/services/suppliers.service';
import { PurchaseOrderItem } from '../entities/purchase-order-item.entity';
import { Ingredient } from 'src/modules/stock/entities/ingredient.entity';
import { PurchaseSuggestion } from '../entities/purchase-suggestion.entity';
import { PurchaseSuggestionStatus } from '../enums/purchase-suggestion-status.enum';

@Injectable()
export class PurchasesService {
  constructor(
    @InjectRepository(PurchaseOrder)
    private readonly purchaseOrderRepo: Repository<PurchaseOrder>,
    @InjectRepository(PurchaseOrderItem)
    private readonly purchaseOrderItemRepo: Repository<PurchaseOrderItem>,
    @InjectRepository(PurchaseSuggestion)
    private readonly purchaseSuggestionRepo: Repository<PurchaseSuggestion>,
    private readonly stockService: StockService,
    private readonly ingredientService: IngredientService,
    private readonly menuItemService: MenuItemService,
    private readonly suppliersService: SuppliersService,
    private readonly dataSource: DataSource,
  ) {}

  async create(
    createDto: CreatePurchaseOrderDto,
    companyId: number,
  ): Promise<PurchaseOrder> {
    const { supplierId, items, ...restDto } = createDto;
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Validate supplier
      await this.suppliersService.findOne(supplierId, companyId);

      const itemsToCreate = [];
      for (const itemDto of items) {
        const { ingredientId, menuItemId } = itemDto;
        if ((!ingredientId && !menuItemId) || (ingredientId && menuItemId)) {
          throw new BadRequestException(
            'Cada item debe tener un ingredientId o un menuItemId, pero no ambos.',
          );
        }

        if (ingredientId) {
          await this.ingredientService.findOneForTenant(
            ingredientId,
            companyId,
          );
          itemsToCreate.push({
            ...itemDto,
            companyId,
            ingredient: { id: ingredientId },
          });
        } else if (menuItemId) {
          await this.menuItemService.findOneForTenant(menuItemId, companyId);
          itemsToCreate.push({
            ...itemDto,
            companyId,
            menuItem: { id: menuItemId },
          });
        }
      }

      const newPurchaseOrder = this.purchaseOrderRepo.create({
        ...restDto,
        supplier: { id: supplierId } as any,
        companyId,
        items: itemsToCreate,
      });

      const savedPO = await queryRunner.manager.save(newPurchaseOrder);
      await queryRunner.commitTransaction();
      return this.findOne((savedPO as any).id, companyId);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(companyId: number): Promise<PurchaseOrder[]> {
    return this.purchaseOrderRepo.find({
      where: { companyId },
      order: { orderDate: 'DESC' },
      relations: ['items', 'items.ingredient', 'items.menuItem', 'supplier'],
    });
  }

  async findOne(id: number, companyId: number): Promise<PurchaseOrder> {
    const purchaseOrder = await this.purchaseOrderRepo.findOne({
      where: { id, companyId } as any,
      relations: ['items', 'items.ingredient', 'items.menuItem', 'supplier'],
    });
    if (!purchaseOrder) {
      throw new NotFoundException(
        `Orden de compra con ID ${id} no encontrada.`,
      );
    }
    return purchaseOrder;
  }

  async receive(
    id: number,
    companyId: number,
    userId: number,
  ): Promise<PurchaseOrder> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const purchaseOrder = await this.findOne(id, companyId);

      if (purchaseOrder.status !== PurchaseOrderStatus.PENDING) {
        throw new BadRequestException(
          `La orden de compra ya ha sido procesada o está cancelada.`,
        );
      }

      for (const item of purchaseOrder.items) {
        if (item.ingredient) {
          // Update the ingredient's last purchase price automatically
          await queryRunner.manager.update(Ingredient, item.ingredient.id, {
            lastPurchasePrice: item.unitCost,
          });
        }

        await this.stockService.registerMovement(
          {
            ingredientId: item.ingredient?.id,
            menuItemId: item.menuItem?.id,
            quantity: item.quantity,
            movementType: MovementType.IN,
            reason: `Recepción de Orden de Compra #${(purchaseOrder as any).id}`,
            unitCost: item.unitCost,
            lotNumber: item.lot,
            expirationDate: item.expirationDate?.toString(),
          },
          companyId,
          userId,
          queryRunner,
        );
      }

      purchaseOrder.status = PurchaseOrderStatus.COMPLETED;
      purchaseOrder.receivedAt = new Date();
      const updatedPO = await queryRunner.manager.save(purchaseOrder);

      await queryRunner.commitTransaction();
      return updatedPO;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async createPurchaseSuggestions(
    shortages: { ingredient: Ingredient; quantity: number }[],
    companyId: number,
    pickingListId?: number,
  ): Promise<void> {
    for (const shortage of shortages) {
      if (shortage.quantity <= 0) {
        // If no shortage anymore, remove any pending suggestion for this context
        await this.purchaseSuggestionRepo.delete({
          ingredientId: shortage.ingredient.id,
          companyId,
          status: PurchaseSuggestionStatus.PENDING,
          pickingListId: pickingListId || null,
        } as any);
        continue;
      }

      // Find existing PENDING suggestion
      let suggestion = await this.purchaseSuggestionRepo.findOne({
        where: {
          ingredientId: shortage.ingredient.id,
          companyId,
          status: PurchaseSuggestionStatus.PENDING,
          pickingListId: pickingListId || null,
        } as any,
      });

      if (suggestion) {
        // Update quantity if it changed
        suggestion.quantity = shortage.quantity;
        suggestion.supplierId = shortage.ingredient.defaultSupplierId;
        await this.purchaseSuggestionRepo.save(suggestion);
      } else {
        suggestion = this.purchaseSuggestionRepo.create({
          ingredientId: shortage.ingredient.id,
          quantity: shortage.quantity,
          companyId,
          supplierId: shortage.ingredient.defaultSupplierId,
          pickingListId: pickingListId,
          status: PurchaseSuggestionStatus.PENDING,
        });
        await this.purchaseSuggestionRepo.save(suggestion);
      }
    }
  }

  async findAllSuggestions(companyId: number): Promise<PurchaseSuggestion[]> {
    return this.purchaseSuggestionRepo.find({
      where: { companyId, status: PurchaseSuggestionStatus.PENDING } as any,
      relations: ['ingredient', 'supplier', 'pickingList'],
    });
  }

  async convertSuggestionsToPO(
    suggestionIds: number[],
    companyId: number,
  ): Promise<PurchaseOrder[]> {
    const suggestions = await this.purchaseSuggestionRepo.find({
      where: {
        id: In(suggestionIds),
        companyId,
        status: PurchaseSuggestionStatus.PENDING,
      } as any,
      relations: ['ingredient', 'supplier'],
    });

    if (suggestions.length === 0) {
      throw new BadRequestException(
        'No hay sugerencias válidas para convertir.',
      );
    }

    // Group by supplier AND picking list
    const groups = new Map<string, PurchaseSuggestion[]>();
    for (const s of suggestions) {
      const sKey = s.supplierId || 'none';
      const pKey = s.pickingListId || 'none';
      const key = `${sKey}_${pKey}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(s);
    }

    const createdPOs: PurchaseOrder[] = [];

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      for (const [key, group] of groups.entries()) {
        const [sIdStr, pIdStr] = key.split('_');
        let finalSupplierId = sIdStr === 'none' ? null : Number(sIdStr);
        const finalPickingListId = pIdStr === 'none' ? null : Number(pIdStr);

        // If no supplier, we assign the first available one as a fallback
        if (!finalSupplierId) {
          const allSuppliers = await this.suppliersService.findAll(companyId);
          if (allSuppliers.length > 0) {
            finalSupplierId = allSuppliers[0].id;
          } else {
            continue; // Cannot create PO without supplier
          }
        }

        // Consolidate items by ingredient within this PO group
        const consolidatedItems = new Map<number, { ingredient: any, quantity: number, unitCost: number }>();
        for (const s of group) {
          const existing = consolidatedItems.get(s.ingredientId);
          if (existing) {
            existing.quantity += s.quantity;
          } else {
            consolidatedItems.set(s.ingredientId, {
              ingredient: { id: s.ingredientId },
              quantity: s.quantity,
              unitCost: s.ingredient.referenceCost || 0,
            });
          }
        }

        const poItems = Array.from(consolidatedItems.values()).map((item) => ({
          ...item,
          companyId,
        }));

        const pickingListInfo = group[0].pickingList
          ? ` para Lista de Picking #${group[0].pickingList.id}`
          : '';

        const po = this.purchaseOrderRepo.create({
          companyId,
          supplier: { id: finalSupplierId } as any,
          orderDate: new Date(),
          status: PurchaseOrderStatus.PENDING,
          items: poItems as any,
          notes: `Generado automáticamente desde sugerencias${pickingListInfo}. IDs Sugerencias: ${group.map((s) => s.id).join(', ')}`,
        });

        const savedPO = await queryRunner.manager.save(po);
        createdPOs.push(savedPO);

        // Mark suggestions as converted
        for (const s of group) {
          s.status = PurchaseSuggestionStatus.CONVERTED;
          await queryRunner.manager.save(s);
        }
      }

      await queryRunner.commitTransaction();

      // IMPORTANT: Re-fetch all created POs with their full relations (names, costs, etc.)
      // so the frontend can display them correctly immediately.
      const fullyPopulatedPOs = await Promise.all(
        createdPOs.map((po) => this.findOne(po.id, companyId)),
      );

      return fullyPopulatedPOs;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async rejectSuggestions(
    suggestionIds: number[],
    companyId: number,
  ): Promise<void> {
    await this.purchaseSuggestionRepo.update(
      { id: In(suggestionIds), companyId } as any,
      { status: PurchaseSuggestionStatus.REJECTED },
    );
  }
}
