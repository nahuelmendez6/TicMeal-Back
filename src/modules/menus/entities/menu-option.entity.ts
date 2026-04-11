import { Entity, Column, PrimaryGeneratedColumn, Index, ManyToOne } from 'typeorm';
import { BaseTenantEntity } from '../../../common/entities/base-tenant.entity';
import { MenuDay } from './menu-day.entity';
// Assuming a Product entity exists in another module, e.g., 'src/modules/products/entities/product.entity.ts'
// import { Product } from '../../products/entities/product.entity';

export enum MealType {
  BREAKFAST = 'BREAKFAST',
  LUNCH = 'LUNCH',
  DINNER = 'DINNER',
  SNACK = 'SNACK', // Added snack as a common meal type
}

@Entity('menu_options')
@Index(['companyId', 'menuDayId', 'mealType'])
export class MenuOption extends BaseTenantEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: MealType })
  mealType: MealType;

  // This will be a foreign key to a Product entity
  // I'm assuming a 'products' module with a 'Product' entity exists or will be created.
  @Column()
  productId: string;

  @ManyToOne(() => MenuDay, (menuDay) => menuDay.menuOptions, { onDelete: 'CASCADE' })
  menuDay: MenuDay;

  @Column()
  menuDayId: string;
}
