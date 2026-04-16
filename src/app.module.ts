import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { getDatabaseConfig } from './config/database.config';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { StockModule } from './modules/stock/stock.module';
import { ShiftModule } from './modules/shift/shift.module';
import { TicketModule } from './modules/tickets/ticket.module';
import { ReportsModule } from './modules/reports/reports.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { AdminAuthModule } from './modules/admin_auth/admin-auth.module';
import { BackofficeUsersModule } from './modules/users_backoffice/backoffice-users.module';
import { TenantContextService } from './common/context/tenant-context.service';
import { TenantInterceptor } from './common/interceptors/tenant-interceptor';
import { TasksModule } from './modules/tasks/tasks.module';
import { PurchasesModule } from './modules/purchases/purchases.module';
import { SuppliersModule } from './modules/suppliers/suppliers.module';
import { WasteModule } from './modules/waste/waste.module';
import { CostingModule } from './modules/costing/costing.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { ProductionModule } from './modules/production/production.module';
import { ScheduleModule } from '@nestjs/schedule';
import { MenusModule } from './modules/menus/menus.module';

/**
 * Modulo raiz de la aplicación
 *
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }), // carga variables de entorno automaticamtne desde .env
    ScheduleModule.forRoot(), // Importante para habilitar los CRON jobs
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => getDatabaseConfig(config),
    }),
    AuthModule,
    UsersModule,
    CompaniesModule,
    StockModule,
    ShiftModule,
    TicketModule,
    ReportsModule,
    AdminAuthModule,
    BackofficeUsersModule,
    TasksModule,
    PurchasesModule,
    SuppliersModule,
    WasteModule,
    CostingModule,
    BookingsModule,
    ProductionModule,
    MenusModule,
  ],
  providers: [TenantContextService, TenantInterceptor],
  exports: [TenantContextService, TenantInterceptor],
})
export class AppModule {}
