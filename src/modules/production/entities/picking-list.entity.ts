import { Entity, PrimaryGeneratedColumn, Column, OneToMany, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseTenantEntity } from 'src/common/entities/base-tenant.entity';
import { PickingListItem } from './picking-list-item.entity';
import { Shift } from 'src/modules/shift/entities/shift.entity';

export enum PickingListStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

@Entity('picking_lists')
@Index(['companyId', 'date', 'shiftId'], { unique: true })
export class PickingList extends BaseTenantEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'date' })
  date: Date;

  @Column({
    type: 'enum',
    enum: PickingListStatus,
    default: PickingListStatus.PENDING,
  })
  status: PickingListStatus;

  @Column({ type: 'boolean', default: false })
  hasStockShortage: boolean;

  @ManyToOne(() => Shift, { nullable: true })
  @JoinColumn({ name: 'shift_id' })
  shift: Shift;

  @Column({ name: 'shift_id', nullable: true })
  shiftId: number;

  @OneToMany(() => PickingListItem, (item) => item.pickingList, {
    cascade: true,
  })
  items: PickingListItem[];

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updatedAt: Date;
}
