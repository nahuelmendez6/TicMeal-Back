import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { BaseTenantEntity } from 'src/common/entities/base-tenant.entity';
import { MenuItems } from 'src/modules/stock/entities/menu-items.entity';
import { MenuOption } from 'src/modules/menus/entities/menu-option.entity';

@Entity({ name: 'shifts' })
export class Shift extends BaseTenantEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100, nullable: false })
  name: string;

  @Column({ type: 'time', nullable: false })
  startTime: string;

  @Column({ type: 'time', nullable: false })
  endTime: string;

  // este campo determina si un turno va a tener un menu asociado o no
  @Column({ type: 'boolean', nullable: false, default: true })
  menuActive: boolean;

  @ManyToMany(() => MenuItems, { eager: false })
  @JoinTable({
    name: 'shift_menu_items',
    joinColumn: { name: 'shift_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'menu_item_id', referencedColumnName: 'id' },
  })
  menuItems: MenuItems[];

  @ManyToMany(() => MenuOption, (menuOption) => menuOption.shifts)
  menuOptions: MenuOption[];
}
