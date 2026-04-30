// src/database/data-source.ts
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as path from 'path';

// Import all entities explicitly
import { Shift } from '../modules/shift/entities/shift.entity';
import { Menu } from '../modules/menus/entities/menu.entity';
import { AdminUser } from '../modules/admin_auth/admin-user.entity';
import { Booking } from '../modules/bookings/entities/booking.entity';
import { Company } from '../modules/companies/entities/company.entity';
import { MenuDay } from '../modules/menus/entities/menu-day.entity';
import { MenuOption } from '../modules/menus/entities/menu-option.entity';
import { PickingListItem } from '../modules/production/entities/picking-list-item.entity';
import { PickingList } from '../modules/production/entities/picking-list.entity';
import { PurchaseOrderItem } from '../modules/purchases/entities/purchase-order-item.entity';
import { PurchaseOrder } from '../modules/purchases/entities/purchase-order.entity';
import { Category } from '../modules/stock/entities/category.entity';
import { IngredientCategory } from '../modules/stock/entities/ingredient-category.entity';
import { IngredientLot } from '../modules/stock/entities/ingredient-lot.entity';
import { Ingredient } from '../modules/stock/entities/ingredient.entity';
import { MealShift } from '../modules/stock/entities/meal-shift.entity';
import { MenuItemLot } from '../modules/stock/entities/menu-item-lot.entity';
import { MenuItems } from '../modules/stock/entities/menu-items.entity';
import { RecipeIngredient } from '../modules/stock/entities/recipe-ingredient.entity';
import { StockAudit } from '../modules/stock/entities/stock-audit.entity';
import { StockMovement } from '../modules/stock/entities/stock-movement.entity';
import { Supplier } from '../modules/suppliers/entities/supplier.entity';
import { TicketItem } from '../modules/tickets/entities/ticket-item.entity';
import { Ticket } from '../modules/tickets/entities/ticket.entity';
import { Observation } from '../modules/users/entities/observation.entity';
import { User } from '../modules/users/entities/user.entity';
import { Invitation } from '../modules/users/entities/invitation.entity';
import { WasteLog } from '../modules/waste/entities/waste-log.entity';


const isCompiled = __filename.endsWith('.js');

export const AppDataSource = new DataSource({
  type: 'postgres', // ⚠️ Cambiado a 'postgres'
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432, // ⚠️ Puerto MySQL
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS || 'nM1258menMa',
  database: process.env.DB_NAME || 'postgres',
  entities: [
    Shift,
    Menu,
    AdminUser,
    Booking,
    Company,
    MenuDay,
    MenuOption,
    PickingListItem,
    PickingList,
    PurchaseOrderItem,
    PurchaseOrder,
    Category,
    IngredientCategory,
    IngredientLot,
    Ingredient,
    MealShift,
    MenuItemLot,
    MenuItems,
    RecipeIngredient,
    StockAudit,
    StockMovement,
    Supplier,
    TicketItem,
    Ticket,
    Observation,
    User,
    Invitation,
    WasteLog,
  ],
  migrations: [
    path.join(__dirname, '/migrations/*' + (isCompiled ? '.js' : '.ts')),
  ],
  synchronize: false,
  logging: true,
});
