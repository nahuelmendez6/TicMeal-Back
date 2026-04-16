import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { BaseTenantEntity } from 'src/common/entities/base-tenant.entity';
import { Shift } from 'src/modules/shift/entities/shift.entity';
import { ApiProperty } from '@nestjs/swagger';

@Entity('timeslots')
export class Timeslot extends BaseTenantEntity {
  @ApiProperty({ example: 1 })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ example: '12:00:00', description: 'Start time of the pickup window' })
  @Column({ type: 'time' })
  startTime: string;

  @ApiProperty({ example: '12:30:00', description: 'End time of the pickup window' })
  @Column({ type: 'time' })
  endTime: string;

  @ApiProperty({ example: 50, description: 'Maximum capacity for this slot' })
  @Column({ type: 'int' })
  capacity: number;

  @ApiProperty({ example: true, description: 'Whether the slot is active' })
  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @ManyToOne(() => Shift, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'shift_id' })
  shift: Shift;

  @ApiProperty({ example: 1, description: 'ID of the associated shift' })
  @Column({ name: 'shift_id' })
  shiftId: number;
}
