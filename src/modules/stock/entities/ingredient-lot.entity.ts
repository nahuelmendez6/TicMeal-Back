import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  Index,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { BaseTenantEntity } from 'src/common/entities/base-tenant.entity';
import { Ingredient } from './ingredient.entity';
import { StockMovement } from './stock-movement.entity';

/**
 * IngredientLot
 * 
 * Represents a specific batch (lot) of an ingredient stored in inventory.
 * 
 * Each lot contains:
 * - A quantity available in stock
 * - A unit aquisition cost
 * - An optional expiration date
 * 
 * 
 * Lots enable inventory strategies such as:
 * - FIFO
 * - FEFO
 * 
 * They also provide traveability for stock movements and cost calculation.
 */
@Entity('ingredient_lots')

/**
 * Ensures that a company cannot have duplicate lot numbers
 * for the same ingredient.
 * 
 * Example:
 * Ingredient A - Lot 123 -> allowed one per company
 */
@Index(['ingredient', 'lotNumber', 'companyId'], { unique: true })
export class IngredientLot extends BaseTenantEntity {
  
  /**
   * Unique identifier for the lot.
  */
  @PrimaryGeneratedColumn()
  id: number;

  /**
   * Ingredient associated with this lot.
   *
   * Many lots can belong to the same ingredient.
   * If the ingredient is deleted, all its lots are also deleted.
  */
  @ManyToOne(() => Ingredient, (ingredient) => ingredient.lots, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'ingredientId' })
  ingredient: Ingredient;

  /**
   * Supplier or production lot number.
   *
   * Used for traceability and inventory tracking.
  */
  @Column({ length: 100 })
  lotNumber: string;

  /**
   * Optional expiration date for the ingredient lot.
   * 
   * Used in FEFO inventor strategies
   * 
   */
  @Column({ type: 'date', nullable: true })
  expirationDate: Date | null;

  /**
   * Current available quantity in stock for this lot
   * 
   * This value is updated throught stock movements
   */
  @Column({ type: 'float' })
  quantity: number;

  /**
   * Unist acquisition cost for the ingredient in this lot.
   * 
   * Stored as decimal to preserve financial precision.
   * Used for cost calculations and inventory valuation.
   */
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  unitCost: number;

  /**
   * Stock movements associated with this lot.
   * 
   * Each movement represents an inventory transaction such as:
   * - purchase
   * - consumption
   * - adjustment
   * - trasnfer
   */
  @OneToMany(() => StockMovement, (movement) => movement.ingredientLot)
  stockMovements: StockMovement[];
}
