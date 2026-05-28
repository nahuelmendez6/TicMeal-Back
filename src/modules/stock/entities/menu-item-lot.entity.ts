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
import { MenuItems } from './menu-items.entity';
import { StockMovement } from './stock-movement.entity';
import { PurchaseOrderItem } from 'src/modules/purchases/entities/purchase-order-item.entity';

@Entity('menu_item_lots')
@Index(['menuItem', 'lotNumber', 'companyId'], { unique: true })
export class MenuItemLot extends BaseTenantEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => MenuItems, (menuItem) => menuItem.lots, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'menuItemId' })
  menuItem: MenuItems;

  /**
   * Purchase order item that created this lot.
   * Used for cost traceability.
   */
  @ManyToOne(() => PurchaseOrderItem, { nullable: true })
  @JoinColumn({ name: 'purchaseOrderItemId' })
  purchaseOrderItem: PurchaseOrderItem | null;

  @Column({ length: 100 })
  lotNumber: string;

  @Column({ type: 'date', nullable: true })
  expirationDate: Date | null;

  @Column({ type: 'float' })
  quantity: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  unitCost: number;

  @OneToMany(() => StockMovement, (movement) => movement.menuItemLot)
  stockMovements: StockMovement[];
}
