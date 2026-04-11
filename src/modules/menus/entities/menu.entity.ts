import { Entity, Column, PrimaryGeneratedColumn, Index } from 'typeorm';
import { BaseTenantEntity } from '../../../common/entities/base-tenant.entity';

export enum MenuPeriodicity {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  BIWEEKLY = 'BIWEEKLY',
  MONTHLY = 'MONTHLY',
}

export enum MenuStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED',
}

@Entity('menus')
@Index(['companyId', 'startDate', 'endDate'])
export class Menu extends BaseTenantEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  name: string;

  @Column({ type: 'date' })
  startDate: Date;

  @Column({ type: 'date' })
  endDate: Date;

  @Column({ type: 'enum', enum: MenuPeriodicity, default: MenuPeriodicity.WEEKLY })
  periodicity: MenuPeriodicity;

  @Column({ type: 'enum', enum: MenuStatus, default: MenuStatus.DRAFT })
  status: MenuStatus;

  @OneToMany(() => MenuDay, (menuDay) => menuDay.menu)
  menuDays: MenuDay[];
}
