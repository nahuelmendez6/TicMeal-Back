import {
  Entity,
  Column,
  OneToMany,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { BaseTenantEntity } from 'src/common/entities/base-tenant.entity';
import { PurchaseOrderStatus } from '../enums/purchase-order-status.enum';
import { PurchaseOrderItem } from './purchase-order-item.entity';
import { Supplier } from 'src/modules/suppliers/entities/supplier.entity';
import { PickingList } from 'src/modules/production/entities/picking-list.entity';

@Entity('purchase_orders')
export class PurchaseOrder extends BaseTenantEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'date' })
  orderDate: Date;

  @ManyToOne(() => Supplier, (supplier) => supplier.purchaseOrders)
  @JoinColumn({ name: 'supplierId' })
  supplier: Supplier;

  @ManyToOne(() => PickingList, { nullable: true })
  @JoinColumn({ name: 'pickingListId' })
  pickingList: PickingList | null;

  @Column({ nullable: true })
  pickingListId: number | null;

  @Column({
    type: 'enum',
    enum: PurchaseOrderStatus,
    default: PurchaseOrderStatus.PENDING,
  })
  status: PurchaseOrderStatus;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @OneToMany(() => PurchaseOrderItem, (item) => item.purchaseOrder, {
    cascade: true,
  })
  items: PurchaseOrderItem[];

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalAmount: number;

  @Column({ type: 'timestamp', nullable: true })
  receivedAt: Date | null;

  @UpdateDateColumn()
  updatedAt: Date;
}
