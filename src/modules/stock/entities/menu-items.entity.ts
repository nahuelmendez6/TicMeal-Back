import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  ManyToOne,
  Index,
  ManyToMany,
} from 'typeorm';

import { BaseTenantEntity } from 'src/common/entities/base-tenant.entity';
import { Category } from './category.entity';
import { RecipeIngredient } from './recipe-ingredient.entity';
import { StockMovement } from './stock-movement.entity';
import { MenuItemLot } from './menu-item-lot.entity';

import { MenuItemType } from '../enums/menuItemTypes';
import { Observation } from 'src/modules/users/entities/observation.entity';
import { NutritionalInfo } from '../dto/nutritional-info.dto';
import { MenuOption } from 'src/modules/menus/entities/menu-option.entity';

@Entity('menu_items')

/**
 * Extiende BaseTenantEntity: Hereda la columna companyId (no nullable)
 */
export class MenuItems extends BaseTenantEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 50, unique: false })
  name: string;

  /** Cantidad disponible (calculado a partir de los lotes). */
  stock: number;

  /** Name of associated icon (optional). */
  @Column({ type: 'varchar', length: 100, nullable: true })
  iconName: string | null;

  /** 
   * Calculated production cost.
   * Sum of ingredients reference costs or manually set base cost.
   */
  @Column({ name: 'cost', type: 'decimal', precision: 10, scale: 2, nullable: true })
  productionCost: number | null;

  /**
   * Last price paid for this menu item in a purchase order.
   * Updated automatically upon receiving a Purchase Order.
   */
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  lastPurchasePrice: number | null;

  /** Tipo de ítem del menú (simple o compuesto). */
  @Column({
    type: 'enum',
    enum: MenuItemType,
    default: MenuItemType.PRODUCTO_SIMPLE,
  })
  type: MenuItemType;

  // Relación ManyToOne con la entidad Category
  @ManyToOne(() => Category, (category) => category.menuItems, {
    nullable: true,
    onDelete: 'SET NULL',
    eager: true, // Cargar la categoría automáticamente al consultar el MenuItem
  })
  category: Category | null;

  /** Cantidad mínima de stock recomendada. */
  @Column({ type: 'int', nullable: true })
  minStock: number | null;

  @Column({ type: 'boolean', default: false })
  isCooked: boolean;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  /** cantudad maxima de item permitido en una orden */
  @Column({ type: 'int', nullable: true })
  maxOrder: number | null;

  /**
   * For SIMPLE items, this stores the product's direct nutritional facts.
   * For COMPOUND items, this stores the calculated nutritional total
   * from its recipe ingredients, acting as a cache.
   */
  @Column({
    type: 'jsonb',
    nullable: true,
  })
  nutritionalInfo: NutritionalInfo | null;

  // Relaciones
  @OneToMany(
    () => RecipeIngredient,
    (recipeIngredient) => recipeIngredient.menuItem,
  )
  recipeIngredients: RecipeIngredient[];

  @OneToMany(() => StockMovement, (movement) => movement.menuItem)
  stockMovements: StockMovement[];

  @OneToMany(() => MenuItemLot, (lot) => lot.menuItem)
  lots: MenuItemLot[];

  isProduced?: boolean;

  @ManyToMany(
    () => Observation,
    (observation: Observation) => observation.menuItems,
  )
  observations: Observation[];

  @OneToMany(() => MenuOption, (menuOption) => menuOption.menuItem)
  menuOptions: MenuOption[];
}
