import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { BaseTenantEntity } from 'src/common/entities/base-tenant.entity';
import { PickingListItem } from './picking-list-item.entity';

export enum PickingListStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

@Entity('picking_lists')
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
