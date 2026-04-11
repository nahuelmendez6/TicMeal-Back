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
// Assuming a Product entity exists in another module, e.g., 'src/modules/products/entities/product.entity.ts'
// import { Product } from '../../products/entities/product.entity';

@Entity('menu_options')
@Index(['companyId', 'menuDayId'])
export class MenuOption extends BaseTenantEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // This will be a foreign key to a Product entity
  // I'm assuming a 'products' module with a 'Product' entity exists or will be created.
  @Column()
  productId: string;

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
