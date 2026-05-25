import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BaseTenantEntity } from 'src/common/entities/base-tenant.entity';
import { Ingredient } from 'src/modules/stock/entities/ingredient.entity';
import { Supplier } from 'src/modules/suppliers/entities/supplier.entity';
import { PickingList } from 'src/modules/production/entities/picking-list.entity';
import { PurchaseSuggestionStatus } from '../enums/purchase-suggestion-status.enum';

@Entity('purchase_suggestions')
export class PurchaseSuggestion extends BaseTenantEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Ingredient, { eager: true })
  @JoinColumn({ name: 'ingredientId' })
  ingredient: Ingredient;

  @Column()
  ingredientId: number;

  @Column({ type: 'float' })
  quantity: number;

  @ManyToOne(() => Supplier, { nullable: true, eager: true })
  @JoinColumn({ name: 'supplierId' })
  supplier: Supplier | null;

  @Column({ nullable: true })
  supplierId: number | null;

  @ManyToOne(() => PickingList, { nullable: true })
  @JoinColumn({ name: 'pickingListId' })
  pickingList: PickingList | null;

  @Column({ nullable: true })
  pickingListId: number | null;

  @Column({
    type: 'enum',
    enum: PurchaseSuggestionStatus,
    default: PurchaseSuggestionStatus.PENDING,
  })
  status: PurchaseSuggestionStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
