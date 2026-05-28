import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { BaseTenantEntity } from 'src/common/entities/base-tenant.entity';
import { MenuItems } from './menu-items.entity';
import { Ingredient } from './ingredient.entity';
import { MovementType, IngredientUnit } from '../enums/enums';
import { User } from 'src/modules/users/entities/user.entity';
import { IngredientLot } from './ingredient-lot.entity';
import { MenuItemLot } from './menu-item-lot.entity';
import { StockAudit } from './stock-audit.entity';
import { PurchaseOrderItem } from 'src/modules/purchases/entities/purchase-order-item.entity';

@Entity('stock_movements')
export class StockMovement extends BaseTenantEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @ManyToOne(() => MenuItems, (item) => item.stockMovements, { nullable: true })
  @JoinColumn({ name: 'menuItemId' })
  menuItem: MenuItems | null;

  @ManyToOne(() => Ingredient, (ingredient) => ingredient.stockMovements, {
    nullable: true,
  })
  @JoinColumn({ name: 'ingredientId' })
  ingredient: Ingredient | null;

  @ManyToOne(() => IngredientLot, (lot) => lot.stockMovements, {
    nullable: true,
  })
  @JoinColumn({ name: 'ingredientLotId' })
  ingredientLot: IngredientLot | null;

  @ManyToOne(() => MenuItemLot, (lot) => lot.stockMovements, { nullable: true })
  @JoinColumn({ name: 'menuItemLotId' })
  menuItemLot: MenuItemLot | null;

  /**
   * Purchase order item associated with this movement.
   */
  @ManyToOne(() => PurchaseOrderItem, { nullable: true })
  @JoinColumn({ name: 'purchaseOrderItemId' })
  purchaseOrderItem: PurchaseOrderItem | null;

  @Column({ type: 'enum', enum: MovementType })
  movementType: MovementType;

  @Column({ type: 'float' })
  quantity: number;

  @Column({
    type: 'float',
    nullable: true,
    comment: 'Stock resultante después del movimiento',
  })
  stockAfter: number | null;

  @Column({ type: 'enum', enum: IngredientUnit })
  unit: IngredientUnit;

  @Column({ type: 'varchar', length: 255, nullable: true })
  reason: string | null;

  @Column({ type: 'varchar', nullable: true })
  relatedTicketId: string | null;

  @ManyToOne(() => User, { nullable: true, eager: false })
  @JoinColumn({ name: 'performedById' })
  performedBy: User | null;

  @ManyToOne(() => StockAudit, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'audit_id' })
  audit: StockAudit;

  @Column({ name: 'audit_id', nullable: true })
  auditId: number;
}
