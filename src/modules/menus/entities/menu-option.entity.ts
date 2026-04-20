import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  Index,
  ManyToOne,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { BaseTenantEntity } from '../../../common/entities/base-tenant.entity';
import { MenuDay } from './menu-day.entity';
import { Shift } from '../../shift/entities/shift.entity';
import { MenuItems } from '../../stock/entities/menu-items.entity';

@Entity('menu_options')
@Index(['companyId', 'menuDayId'])
export class MenuOption extends BaseTenantEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => MenuItems, (menuItem) => menuItem.menuOptions, {
    nullable: false,
  })
  menuItem: MenuItems;

  @Column()
  menuItemId: number;

  @ManyToOne(() => MenuDay, (menuDay) => menuDay.menuOptions, {
    onDelete: 'CASCADE',
  })
  menuDay: MenuDay;

  @Column()
  menuDayId: string;

  @ManyToMany(() => Shift)
  @JoinTable({
    name: 'menu_option_shifts',
    joinColumn: { name: 'menu_option_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'shift_id', referencedColumnName: 'id' },
  })
  shifts: Shift[];
}
