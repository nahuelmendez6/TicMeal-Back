import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BaseTenantEntity } from 'src/common/entities/base-tenant.entity';
import { User } from 'src/modules/users/entities/user.entity';
import { MenuOption } from 'src/modules/menus/entities/menu-option.entity';
import { Timeslot } from './timeslot.entity';
import { ApiProperty } from '@nestjs/swagger';

export enum ReservationStatus {
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
}

@Entity('reservations')
@Index(['ticketCode'], { unique: true })
export class Reservation extends BaseTenantEntity {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({
    enum: ReservationStatus,
    example: ReservationStatus.CONFIRMED,
    description: 'Current status of the reservation',
  })
  @Column({
    type: 'enum',
    enum: ReservationStatus,
    default: ReservationStatus.CONFIRMED,
  })
  status: ReservationStatus;

  @ApiProperty({
    example: 'TKT-ABC123',
    description: 'Unique ticket code for the reservation',
  })
  @Column({ name: 'ticket_code', unique: true })
  ticketCode: string;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ApiProperty({ example: 1, description: 'ID of the user who made the reservation' })
  @Column({ name: 'user_id' })
  userId: number;

  @ManyToOne(() => MenuOption, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'menu_option_id' })
  menuOption: MenuOption;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440001',
    description: 'ID of the selected menu option',
  })
  @Column({ name: 'menu_option_id' })
  menuOptionId: string;

  @ManyToOne(() => Timeslot, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'timeslot_id' })
  timeslot: Timeslot;

  @ApiProperty({ example: 1, description: 'ID of the selected pickup timeslot' })
  @Column({ name: 'timeslot_id' })
  timeslotId: number;

  @ApiProperty()
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ApiProperty()
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
