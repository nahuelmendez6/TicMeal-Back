import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BaseTenantEntity } from 'src/common/entities/base-tenant.entity';
import { User } from 'src/modules/users/entities/user.entity';
import { MenuOption } from 'src/modules/menus/entities/menu-option.entity';
import { Timeslot } from './timeslot.entity';
import { ApiProperty } from '@nestjs/swagger';

export enum WaitlistStatus {
  PENDING = 'PENDING',
  FULFILLED = 'FULFILLED',
  CANCELLED = 'CANCELLED',
}

@Entity('waiting_list_entries')
export class WaitingListEntry extends BaseTenantEntity {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440002' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ApiProperty({ example: 1 })
  @Column({ name: 'user_id' })
  userId: number;

  @ManyToOne(() => MenuOption, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'menu_option_id' })
  menuOption: MenuOption;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440001' })
  @Column({ name: 'menu_option_id' })
  menuOptionId: string;

  @ManyToOne(() => Timeslot, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'timeslot_id' })
  timeslot: Timeslot;

  @ApiProperty({ example: 1 })
  @Column({ name: 'timeslot_id' })
  timeslotId: number;

  @ApiProperty({ enum: WaitlistStatus, default: WaitlistStatus.PENDING })
  @Column({
    type: 'enum',
    enum: WaitlistStatus,
    default: WaitlistStatus.PENDING,
  })
  status: WaitlistStatus;

  @ApiProperty({
    example: 1,
    description: 'Priority or position in the waitlist for this specific timeslot',
  })
  @Column({ type: 'int', default: 1 })
  priority: number;

  @ApiProperty()
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ApiProperty()
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
