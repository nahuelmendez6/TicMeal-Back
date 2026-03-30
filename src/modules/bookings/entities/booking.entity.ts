import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { BaseTenantEntity } from 'src/common/entities/base-tenant.entity';
import { User } from 'src/modules/users/entities/user.entity'; // Assuming User is in this path
import { MealShift } from 'src/modules/stock/entities/meal-shift.entity'; // Assuming MealShift is in this path

export enum BookingStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
  WAITLISTED = 'WAITLISTED',
}

@Entity('bookings')
export class Booking extends BaseTenantEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'enum', enum: BookingStatus, default: BookingStatus.PENDING })
  status: BookingStatus;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: number;

  @ManyToOne(() => MealShift, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'meal_shift_id' })
  mealShift: MealShift;

  @Column({ name: 'meal_shift_id' })
  mealShiftId: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updatedAt: Date;
}
