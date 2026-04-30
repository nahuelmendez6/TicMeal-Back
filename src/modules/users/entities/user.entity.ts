import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  ManyToMany,
  CreateDateColumn,
  UpdateDateColumn,
  JoinTable,
} from 'typeorm';
import { Observation } from './observation.entity';
import { BaseTenantEntity } from 'src/common/entities/base-tenant.entity';
import { Ticket } from 'src/modules/tickets/entities/ticket.entity';

@Entity({ name: 'users' })
export class User extends BaseTenantEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true, nullable: true })
  username: string;

  @Column({ unique: true, nullable: true })
  email: string;

  @Column({ name: 'pin_hash', length: 255, nullable: true })
  pinHash: string;

  @Column({ nullable: true })
  password: string;

  @Column({ nullable: true })
  firstName: string;

  @Column({ nullable: true })
  lastName: string;

  @Column({ default: false })
  isEmailVerified: boolean;

  // Campo que almacena el código de verificación (una cadena de 6 dígitos o un token)
  @Column({ nullable: true, type: 'varchar', length: 6 }) // <-- Especifica 'varchar' y un length apropiado
  verificationCode: string | null; // <-- Asegúrate de que el tipo sea 'string' o 'string | null'

  // El campo de fecha que ya corregimos:
  @Column({ type: 'timestamp', nullable: true })
  verificationCodeExpiresAt: Date | null;

  @Column({
    type: 'enum',
    enum: ['super_admin', 'company_admin', 'diner', 'kitchen', 'kitchen_admin'],
    default: 'diner',
  })
  role: string;

  @ManyToMany(() => Observation, (observation) => observation.users, {
    cascade: true,
  })
  @JoinTable({
    name: 'user_observations',
    joinColumn: { name: 'user_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'observation_id', referencedColumnName: 'id' },
  })
  observations: Observation[];

  @OneToMany(() => Ticket, (ticket) => ticket.user)
  tickets: Ticket[];

  @Column({ default: true })
  isActive: boolean;

  @Column({ name: 'is_first_login', default: true })
  isFirstLogin: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
