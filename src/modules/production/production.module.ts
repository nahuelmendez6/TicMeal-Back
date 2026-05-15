import { Module } from '@nestjs/common';
import { ProductionService } from './production/production.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PickingList } from './entities/picking-list.entity';
import { PickingListItem } from './entities/picking-list-item.entity';
import { Booking } from 'src/modules/bookings/entities/booking.entity';
import { Reservation } from 'src/modules/reservations/entities/reservation.entity';
import { MealShift } from 'src/modules/stock/entities/meal-shift.entity';
import { Company } from 'src/modules/companies/entities/company.entity';
import { Ingredient } from 'src/modules/stock/entities/ingredient.entity';
import { MenuItems } from 'src/modules/stock/entities/menu-items.entity';
import { RecipeIngredient } from 'src/modules/stock/entities/recipe-ingredient.entity';
import { PurchaseOrder } from 'src/modules/purchases/entities/purchase-order.entity';
import { PurchaseOrderItem } from 'src/modules/purchases/entities/purchase-order-item.entity';
import { ProductionController } from './production/production.controller';
import { Supplier } from '../suppliers/entities/supplier.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PickingList,
      PickingListItem,
      Booking,
      Reservation,
      MealShift,
      Company,
      Ingredient,
      MenuItems,
      RecipeIngredient,
      PurchaseOrder,
      PurchaseOrderItem,
      Supplier
    ]),
  ],
  providers: [ProductionService],
  exports: [ProductionService],
  controllers: [ProductionController],
})
export class ProductionModule {}
