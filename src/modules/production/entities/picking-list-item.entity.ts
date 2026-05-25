import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { PickingList } from './picking-list.entity';
import { Ingredient } from 'src/modules/stock/entities/ingredient.entity';

@Entity('picking_list_items')
export class PickingListItem {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => PickingList, (pickingList) => pickingList.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'picking_list_id' })
  pickingList: PickingList;

  @Column({ name: 'picking_list_id' })
  pickingListId: number;

  @ManyToOne(() => Ingredient, { eager: true })
  @JoinColumn({ name: 'ingredient_id' })
  ingredient: Ingredient;

  @Column({ name: 'ingredient_id' })
  ingredientId: number;

  @Column({ type: 'float' })
  requiredQuantity: number;

  @Column({ type: 'float', default: 0 })
  pickedQuantity: number;

  @Column({ type: 'boolean', default: false })
  hasShortage: boolean;
}
