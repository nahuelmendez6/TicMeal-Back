import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  AfterLoad,
  BeforeUpdate,
} from 'typeorm';
import { BaseTenantEntity } from 'src/common/entities/base-tenant.entity';
import { MenuItems } from './menu-items.entity';
// Verify this path matches your Shift entity location
import { Shift } from 'src/modules/shift/entities/shift.entity';

export enum Periodicity {
  ONCE = 'ONCE',
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
}

@Entity('meal_shifts')
export class MealShift extends BaseTenantEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'enum',
    enum: Periodicity,
    default: Periodicity.ONCE,
  })
  periodicity: Periodicity;

  @Column({ type: 'date' })
  startDate: Date;

  @Column({ type: 'date', nullable: true })
  endDate: Date | null;

  @Column('simple-array', { nullable: true })
  daysOfWeek: number[] | null; // e.g., [1, 3, 5] for Mon, Wed, Fri

  @ManyToOne(() => Shift)
  @JoinColumn({ name: 'shiftId' })
  shift: Shift;

  @Column()
  shiftId: number;

  @ManyToOne(() => MenuItems)
  @JoinColumn({ name: 'menuItemId' })
  menuItem: MenuItems;

  @Column()
  menuItemId: number;

  @Column({ type: 'float', default: 0 })
  quantityProduced: number;

  @Column({ type: 'float', default: 0 })
  quantityAvailable: number;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  private originalQuantityProduced: number;

  @AfterLoad()
  setOriginalQuantityProduced() {
    this.originalQuantityProduced = this.quantityProduced;
  }

  @BeforeUpdate()
  updateQuantityAvailable() {
    if (
      this.originalQuantityProduced !== undefined &&
      this.quantityProduced !== this.originalQuantityProduced
    ) {
      const diff = this.quantityProduced - this.originalQuantityProduced;
      this.quantityAvailable = (this.quantityAvailable || 0) + diff;
      this.originalQuantityProduced = this.quantityProduced;
    }
  }
}
