import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  Index,
  ManyToOne,
  ManyToMany,
  JoinColumn,
} from 'typeorm';

import { BaseTenantEntity } from 'src/common/entities/base-tenant.entity';

import { IngredientUnit, IngredientCostType } from '../enums/enums';
import { RecipeIngredient } from './recipe-ingredient.entity';
import { StockMovement } from './stock-movement.entity';
import { IngredientCategory } from './ingredient-category.entity';
import { IngredientLot } from './ingredient-lot.entity';
import { Observation } from 'src/modules/users/entities/observation.entity';
import { NutritionalInfo } from '../dto/nutritional-info.dto';
import { Supplier } from 'src/modules/suppliers/entities/supplier.entity';

/**
 * Ingredient
 *
 * Represents a raw material or supply used in recipes nad inventory
 *
 * This entity defines the base information about an ingredient such as:
 * - measurement unit
 * - cost configuration
 * - category
 * - stock management parameters
 *
 * Actual stock levels are managed through ingredient lots and stock movements,
 * enabling traceability and FIFO/FEFO inventory strategies.
 */
@Entity('ingredients')
/**
 * Ensures ingredient names are unique per company.
 *
 * This allows different companies (tenants) to have ingredients
 * with the same name while maintaining isolation between tenants.
 */
@Index(['companyId', 'name'], { unique: true })
export class Ingredient extends BaseTenantEntity {
  /**
   * Unique identifier for the ingredient.
   */
  @PrimaryGeneratedColumn()
  id: number;

  /**
   * Ingredient name.
   *
   * Uniqueness is enforced per company via the composite index above.
   */
  @Column({ length: 50, unique: false }) // La unicidad se maneja con el índice compuesto
  name: string;

  /**
   * Current available stock quantity.
   *
   * This value is typically calculated dynamically based on
   * the quantities of all associated ingredient lots.
   *
   * It is not persisted in the database.
   */
  quantityInStock: number;

  /**
   * Measurement unit used for this ingredient.
   *
   * Examples:
   * - UNIT
   * - KG
   * - LITER
   */
  @Column({ type: 'enum', enum: IngredientUnit, default: IngredientUnit.UNIT })
  unit: IngredientUnit;

  /**
   * Optional base purchase cost for the ingredient.
   *
   * This serves as a reference cost when lot-level
   * cost tracking is not available, or for recipe estimation.
   */
  @Column({ name: 'cost', type: 'decimal', precision: 10, scale: 2, nullable: true })
  referenceCost: number | null;

  /**
   * Last price paid for this ingredient in a purchase order.
   * Updated automatically upon receiving a Purchase Order.
   */
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  lastPurchasePrice: number | null;

  /**
   * Defines how the ingredient cost is interpreted.
   *
   * Example:
   * - cost per unit
   * - cost per weight or volume
   */
  @Column({ type: 'enum', enum: IngredientCostType, nullable: true })
  costType: IngredientCostType | null;

  /**
   * Optional description providing additional details
   * about the ingredient.
   */
  @Column({ type: 'text', nullable: true })
  description: string | null;

  /**
   * Category assigned to the ingredient.
   *
   * Used for organization and filtering.
   * If the category is deleted, the ingredient will remain
   * but its category will be set to null.
   */
  @ManyToOne(() => IngredientCategory, (category) => category.menuItems, {
    nullable: true,
    onDelete: 'SET NULL',
    eager: true, // Cargar la categoría automáticamente al consultar el MenuItem
  })
  category: IngredientCategory | null;

  /**
   * Recommended minimum stock level.
   *
   * Used to trigger alerts when inventory falls below
   * a defined threshold.
   */
  @Column({ type: 'float', nullable: true })
  minStock: number | null;

  /**
   * Shrinkage or yield percentage for the ingredient.
   *
   * Represents expected loss during preparation
   * (e.g., trimming, cooking loss, evaporation).
   *
   * Example:
   * 20 means 20% loss.
   */
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  shrinkagePercentage: number;

  /**
   * Nutritional information for the ingredient, typically per 100g or base unit.
   * This serves as the source of truth for recipe nutritional calculations.
   */
  @Column({
    type: 'jsonb',
    nullable: true,
  })
  nutritionalInfo: NutritionalInfo | null;

  /**
   * Recipe relationships.
   *
   * Defines which recipes use this ingredient
   * and in what quantities.
   */
  @OneToMany(
    () => RecipeIngredient,
    (recipeIngredient) => recipeIngredient.ingredient,
  )
  recipeIngredients: RecipeIngredient[];

  /**
   * All stock movements affecting this ingredient.
   *
   * These movements represent inventory transactions
   * such as purchases, consumption, adjustments, etc.
   */
  @OneToMany(() => StockMovement, (movement) => movement.ingredient)
  stockMovements: StockMovement[];

  /**
   * Inventory lots associated with this ingredient.
   *
   * Each lot represents a batch with its own
   * quantity, cost, and expiration date.
   */
  @OneToMany(() => IngredientLot, (lot) => lot.ingredient)
  lots: IngredientLot[];

  /**
   * Indicates whether the ingredient is active
   * and available for use in the system.
   *
   * Deactivating an ingredient prevents it from being
   * used in new recipes or stock operations.
   */
  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'boolean', default: false })
  isFresh: boolean;

  @ManyToOne(() => Supplier, { nullable: true })
  @JoinColumn({ name: 'defaultSupplierId' })
  defaultSupplier: Supplier;

  @Column({ name: 'defaultSupplierId', nullable: true })
  defaultSupplierId: number;

  @ManyToMany(
    () => Observation,
    (observation: Observation) => observation.ingredients,
  )
  observations: Observation[];
}

