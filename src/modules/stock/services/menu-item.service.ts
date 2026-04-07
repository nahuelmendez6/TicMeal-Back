import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { MenuItems } from '../entities/menu-items.entity';
import { Category } from '../entities/category.entity';
import { CreateMenuItemDto } from '../dto/create-menu-item-dto';
import { UpdateMenuItemDto } from '../dto/update-menu-item-dto';
import { CategoryService } from './category.service';
import { IngredientService } from './ingredient.service';
import { MovementType } from '../enums/enums';
import { MenuItemType } from '../enums/menuItemTypes';
import { RecipeIngredient } from '../entities/recipe-ingredient.entity';
import { MealShiftService } from './meal-shift.service';
import { StockService } from './stock.service';
import { NutritionalInfo } from '../dto/nutritional-info.dto';
import { IngredientUnit } from '../enums/enums';

@Injectable()
export class MenuItemService {
  constructor(
    @InjectRepository(MenuItems)
    private readonly menuItemRepo: Repository<MenuItems>,
    @InjectRepository(RecipeIngredient)
    private readonly recipeIngredientRepo: Repository<RecipeIngredient>,
    private readonly categoryService: CategoryService,
    @Inject(forwardRef(() => IngredientService))
    private readonly ingredientService: IngredientService,
    private readonly mealShiftService: MealShiftService,
    private readonly stockService: StockService,
    private readonly dataSource: DataSource,
  ) {}

  async create(
    createDto: CreateMenuItemDto,
    companyId: number,
    userId: number,
  ): Promise<MenuItems> {
    const {
      recipeIngredients: recipeDto,
      categoryId,
      // stock is no longer managed here
      ...menuItemData
    } = createDto;

    if (categoryId) {
      await this.categoryService.validateCategoryAvailability(
        categoryId,
        companyId,
      );
    }

    if (recipeDto && recipeDto.length > 0) {
      const ingredientIds = recipeDto.map((ri) => ri.ingredientId);
      const ingredients =
        await this.ingredientService.findAllForTenant(companyId);
      const tenantIngredientIds = ingredients.map((i) => i.id);

      for (const id of ingredientIds) {
        if (!tenantIngredientIds.includes(id)) {
          throw new BadRequestException(
            `El ingrediente con ID ${id} no existe o no pertenece a su empresa.`,
          );
        }
      }
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const newMenuItem = queryRunner.manager.create(MenuItems, {
        ...menuItemData,
        companyId,
        category: categoryId ? { id: categoryId } : null,
      });
      const savedMenuItem = await queryRunner.manager.save(newMenuItem);

      if (recipeDto && recipeDto.length > 0) {
        const recipe = recipeDto.map((ri) =>
          queryRunner.manager.create(RecipeIngredient, {
            menuItem: savedMenuItem,
            ingredient: { id: ri.ingredientId },
            quantity: ri.quantity,
          }),
        );
        const savedRecipeIngredients = await queryRunner.manager.save(recipe);
        savedMenuItem.recipeIngredients = savedRecipeIngredients; // Populate the relation
      }
      await queryRunner.manager.getRepository(MenuItems).reload(savedMenuItem); // Reload to ensure relations are loaded

      // Initial stock must now be added via an explicit stock movement, not on creation.

      await queryRunner.commitTransaction();
      await this.calculateAndCacheNutritionalInfo(savedMenuItem); // Pass the fully loaded object
      return this.findOneForTenant(savedMenuItem.id, companyId);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async findAllForTenant(
    companyId: number,
    shiftId?: number,
    date?: Date,
  ): Promise<MenuItems[]> {
    const menuItems = await this.menuItemRepo.find({
      where: { companyId },
      relations: [
        'category',
        'recipeIngredients',
        'recipeIngredients.ingredient',
        'lots', // Eagerly load lots
      ],
      order: { name: 'ASC' },
    });

    for (const item of menuItems) {
      // Calculate stock from lots
      item.stock = item.lots
        ? item.lots.reduce((sum, lot) => sum + lot.quantity, 0)
        : 0;

      let isProduced = item.type !== MenuItemType.PRODUCTO_COMPUESTO;
      if (shiftId && date && item.type === MenuItemType.PRODUCTO_COMPUESTO) {
        isProduced = await this.mealShiftService.isMenuItemProducedForShift(
          item.id,
          shiftId,
          date,
          companyId,
        );
      }
      item.isProduced = isProduced;
    }

    return menuItems;
  }

  async findOneForTenant(id: number, companyId: number): Promise<MenuItems> {
    const menuItem = await this.menuItemRepo.findOne({
      where: { id, companyId },
      relations: [
        'category',
        'recipeIngredients',
        'recipeIngredients.ingredient',
        'lots',
      ],
    });

    if (!menuItem) {
      throw new NotFoundException(
        `Ítem de menú con ID ${id} no encontrado o sin permisos.`,
      );
    }

    // Calculate stock from lots
    menuItem.stock = menuItem.lots
      ? menuItem.lots.reduce((sum, lot) => sum + lot.quantity, 0)
      : 0;

    return menuItem;
  }

  async update(
    id: number,
    updateDto: UpdateMenuItemDto,
    companyId: number,
    userId: number,
  ): Promise<MenuItems> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const menuItemToUpdate = await queryRunner.manager.findOne(MenuItems, {
        where: { id, companyId },
      });

      if (!menuItemToUpdate) {
        throw new NotFoundException(`Ítem de menú con ID ${id} no encontrado.`);
      }

      const {
        recipeIngredients: recipeDto,
        categoryId,
        // stock is no longer managed here
        ...menuItemData
      } = updateDto;

      if (categoryId && categoryId !== menuItemToUpdate.category?.id) {
        await this.categoryService.validateCategoryAvailability(
          categoryId,
          companyId,
        );
      }

      queryRunner.manager.merge(MenuItems, menuItemToUpdate, menuItemData);

      if (updateDto.hasOwnProperty('categoryId')) {
        menuItemToUpdate.category = categoryId
          ? ({ id: categoryId } as Category)
          : null;
      }

      await queryRunner.manager.save(menuItemToUpdate);

      if (recipeDto) {
        await queryRunner.manager.delete(RecipeIngredient, {
          menuItem: { id },
        });
        if (recipeDto.length > 0) {
          const newRecipe = recipeDto.map((ri) =>
            queryRunner.manager.create(RecipeIngredient, {
              menuItem: { id },
              ingredient: { id: ri.ingredientId },
              quantity: ri.quantity,
            }),
          );
          const savedRecipeIngredients = await queryRunner.manager.save(newRecipe);
          menuItemToUpdate.recipeIngredients = savedRecipeIngredients; // Populate the relation
        } else {
          menuItemToUpdate.recipeIngredients = []; // Clear if no recipe items
        }
      }
      await queryRunner.manager.getRepository(MenuItems).reload(menuItemToUpdate); // Reload to ensure relations are loaded

      // The block that caused the error has been removed.
      // Stock adjustments must be done via explicit calls to StockService.

      await queryRunner.commitTransaction();
      await this.calculateAndCacheNutritionalInfo(menuItemToUpdate); // Pass the fully loaded object
      return this.findOneForTenant(menuItemToUpdate.id, companyId);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async calculateAndCacheNutritionalInfo(menuItem: MenuItems): Promise<NutritionalInfo | null> {
  

    if (!menuItem || menuItem.type !== MenuItemType.PRODUCTO_COMPUESTO) {
      // Si no es un producto compuesto, no hay nada que calcular.
      // Su información nutricional se gestiona manualmente.
      return menuItem.nutritionalInfo;
    }
  
    if (!menuItem.recipeIngredients || menuItem.recipeIngredients.length === 0) {
      // Si no tiene receta, la info es nula.
      console.log(`[MenuItemService] No recipe ingredients found for MenuItem ${menuItem.id}. Setting nutritionalInfo to null.`);
      await this.menuItemRepo.update(menuItem.id, { nutritionalInfo: null });
      return null;
    }
  
    // Inicializamos el acumulador
    const totalNutritionalInfo: NutritionalInfo = {
      calories: 0,
      protein: 0,
      carbohydrates: 0,
      fat: 0,
      sugar: 0,
      sodium: 0,
    };


    for (const recipeIngredient of menuItem.recipeIngredients) {
      const { ingredient, quantity } = recipeIngredient;

      if (!ingredient || !ingredient.nutritionalInfo) {
        continue;
      }

      let normalizedQuantity: number;
      let divisor: number;

      if (ingredient.unit === IngredientUnit.UNIT) {
        normalizedQuantity = quantity;
        divisor = 1;
      } else {
        switch (ingredient.unit) {
          case IngredientUnit.GRAMS:
            normalizedQuantity = quantity;
            break;
          case IngredientUnit.KILOGRAMS:
            normalizedQuantity = quantity * 1000;
            break;
          case IngredientUnit.MILLILITERS:
            normalizedQuantity = quantity;
            break;
          case IngredientUnit.LITERS:
            normalizedQuantity = quantity * 1000;
            break;
          default:
            normalizedQuantity = quantity;
        }
        divisor = 100;
      }

      const scale = normalizedQuantity / divisor;

      // --- Debugging logs for scaling ---
      console.log(`Normalized Quantity: ${normalizedQuantity}`);
      console.log(`Divisor: ${divisor}`);
      console.log(`Scale: ${scale}`);
      console.log(`Calculated calories contribution: ${(ingredient.nutritionalInfo.calories || 0) * scale}`);
      // --- End Debugging logs ---

      totalNutritionalInfo.calories += (ingredient.nutritionalInfo.calories || 0) * scale;
      totalNutritionalInfo.protein += (ingredient.nutritionalInfo.protein || 0) * scale;
      totalNutritionalInfo.carbohydrates += (ingredient.nutritionalInfo.carbohydrates || 0) * scale;
      totalNutritionalInfo.fat += (ingredient.nutritionalInfo.fat || 0) * scale;
      totalNutritionalInfo.sugar += (ingredient.nutritionalInfo.sugar || 0) * scale;
      totalNutritionalInfo.sodium += (ingredient.nutritionalInfo.sodium || 0) * scale;
      console.log(`Total Nutritional Info after ${ingredient?.name}:`, totalNutritionalInfo); // Log after each ingredient
    }
    // Guardamos el resultado calculado (caché) en el MenuItem
    await this.menuItemRepo.update(menuItem.id, { nutritionalInfo: totalNutritionalInfo });
  
    return totalNutritionalInfo;
  }


  async recalculateNutritionalInfoForIngredient(ingredientId: number) {
    const menuItems = await this.menuItemRepo.find({
      where: {
        recipeIngredients: {
          ingredient: {
            id: ingredientId
          }
        }
      },
      relations: ['recipeIngredients', 'recipeIngredients.ingredient'] // Ensure ingredient is loaded to get companyId
    });

    if (menuItems.length === 0) {
      return; // No menu items to recalculate for this ingredient
    }

    // All menu items found here should belong to the same company
    const companyId = menuItems[0].companyId;

    for (const menuItem of menuItems) {
      // Fetch the full menuItem with relations
      const fullMenuItem = await this.findOneForTenant(menuItem.id, companyId);
      await this.calculateAndCacheNutritionalInfo(fullMenuItem);
    }
  }

  async remove(id: number, companyId: number): Promise<boolean> {
    const result = await this.menuItemRepo.delete({ id, companyId });

    if (result.affected === 0) {
      throw new NotFoundException(
        `Ítem de menú con ID ${id} no encontrado en su alcance.`,
      );
    }

    return true;
  }
}
