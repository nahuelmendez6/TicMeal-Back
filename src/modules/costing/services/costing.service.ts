import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { MenuItems } from '../../stock/entities/menu-items.entity';
import { IngredientLot } from '../../stock/entities/ingredient-lot.entity';

@Injectable()
export class CostingService {
  constructor(
    // Repository used to retrieve menu items and their associated recipe ingredients
    @InjectRepository(MenuItems)
    private readonly menuItemsRepo: Repository<MenuItems>,
    
    // Repository used to retrieve ingredient stock lots for FIFO cost calculation
    @InjectRepository(IngredientLot)
    private readonly ingredientLotRepo: Repository<IngredientLot>,
  ) {}

  /**
   * Calculates the total production cost of a menu item based on its recipe
   * 
   * The cost is determined by summing the cost of each ingredient required
   * in the recipe. Ingredient cost is calculated using a FIFO strategy
   * (based on available ingredient losts).
   * 
   * Shrincage/waste percentage of each ingredient is also considered,
   * adjusting the real quantity needed to produce the recipe.
   * @param menuItemId  - ID of the menu item to calculate cost for
   * @param companyId  - Company identifier to ensure data isolation
   * @returns  Total cost of producing the menu item
   */
  async calculateMenuItemCost(
    menuItemId: number,
    companyId: number,
  ): Promise<number> {
    // Fetch the menu item with its recipe ingredients and metadata
    const menuItem = await this.menuItemsRepo.findOne({
      where: { id: menuItemId, companyId },
      relations: ['recipeIngredients', 'recipeIngredients.ingredient'],
    });

    // If the menu item is not found, throw a 404 error
    if (!menuItem) {
      throw new NotFoundException('Ítem de menú no encontrado.');
    }

    // If the menu item has no recipe ingredients, return 0 cost
    if (
      !menuItem.recipeIngredients ||
      menuItem.recipeIngredients.length === 0
    ) {
      return 0; // O el costo base del producto si no es elaborado
    }

    let totalCost = 0;

    // Iterate though each ingredient in the recipe
    for (const recipeIngredient of menuItem.recipeIngredients) {
      const { ingredient, quantity } = recipeIngredient;
      
      /**
       * adjust required quantity considering ingredient shrinkage/waste.
       * Example:
       * If a recipe needs 100g and shrinkage is 10%, the system must 
       * consume ~111g of raw ingredient to obtaing 100g usable
       */
      const realQuantity =
        quantity / (1 - ingredient.shrinkagePercentage / 100);

      // calculate using FIFO stock consumption strategy to get the cost for the required quantity of the ingredient
      const costForIngredient = await this.getFifoCostForIngredient(
        ingredient.id,
        realQuantity,
        companyId,
      );
      totalCost += costForIngredient;
    }

    return totalCost;
  }

  /**
   * Calculates the cost of a given ingredient quantity using
   * FIFO lot consumption.
   * 
   * Ingredient lots are ordered by expiration date
   * The method simulates stock consumption without
   * modifying actual inventory.
   * 
   * 
   * @param ingredientId - Ingredient indetifier
   * @param quantityNeeded - Quantity requried for the recipe
   * @param companyId  - Company identifier
   * @returns Total cost of the required ingredient quantity
   */
  private async getFifoCostForIngredient(
    ingredientId: number,
    quantityNeeded: number,
    companyId: number,
  ): Promise<number> {
    const lots = await this.ingredientLotRepo.find({
      where: {
        ingredient: { id: ingredientId },
        companyId,
        quantity: MoreThan(0),
      },
      order: {
        expirationDate: 'ASC', // O createdAt si se prefiere FIFO estricto
      },
    });

    let cost = 0;
    let quantityToCover = quantityNeeded;

    // simulate consumption across lots
    for (const lot of lots) {
      if (quantityToCover <= 0) break;

      // determine how much can be taken from the current lot
      const quantityToTake = Math.min(lot.quantity, quantityToCover);

      // add cost contribution from this lot
      cost += quantityToTake * lot.unitCost;

      // reduce remaining quantity to cover
      quantityToCover -= quantityToTake;
    }

    // if not enough stock was available across all lots, throw an error  
    if (quantityToCover > 0) {
      throw new BadRequestException(
        `Stock insuficiente para el ingrediente ${ingredientId}. Faltan ${quantityToCover} unidades.`,
      );
    }

    return cost;
  }
}
