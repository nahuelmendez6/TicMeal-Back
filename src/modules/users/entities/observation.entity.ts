import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { User } from './user.entity';
import { BaseTenantEntity } from 'src/common/entities/base-tenant.entity';
import { Ingredient } from 'src/modules/stock/entities/ingredient.entity';
import { MenuItems } from 'src/modules/stock/entities/menu-items.entity';

@Entity({ name: 'observations' })
export class Observation extends BaseTenantEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 50 })
  name: string;

  @Column({ name: 'icon_name', length: 50 })
  iconName: string;

  @ManyToMany('User', (user: User) => user.observations)
  users: User[];

  @ManyToMany(
    () => Ingredient,
    (ingredient: Ingredient) => ingredient.observations,
  )
  @JoinTable({
    name: 'observation_ingredient',
    joinColumn: { name: 'observation_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'ingredient_id', referencedColumnName: 'id' },
  })
  ingredients: Ingredient[];

  @ManyToMany(() => MenuItems, (menuItem: MenuItems) => menuItem.observations)
  @JoinTable({
    name: 'observation_menu_item',
    joinColumn: { name: 'observation_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'menu_item_id', referencedColumnName: 'id' },
  })
  menuItems: MenuItems[];
}
