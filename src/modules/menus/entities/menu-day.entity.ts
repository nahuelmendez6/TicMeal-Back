import { Entity, Column, PrimaryGeneratedColumn, Index, ManyToOne, OneToMany } from 'typeorm';
import { BaseTenantEntity } from '../../../common/entities/base-tenant.entity';
import { Menu } from './menu.entity';
import { MenuOption } from './menu-option.entity';


@Entity('menu_days')
@Index(['companyId', 'date'])
export class MenuDay extends BaseTenantEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'date' })
  date: Date;

  @ManyToOne(() => Menu, (menu) => menu.menuDays, { onDelete: 'CASCADE' })
  menu: Menu;

  @Column()
  menuId: string;

  @OneToMany(() => MenuOption, (menuOption) => menuOption.menuDay)
  menuOptions: MenuOption[];
}
