import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { ReservationsService } from '../services/reservations.service';
import { CreateReservationDto } from '../dto/create-reservation.dto';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/modules/auth/guards/roles.guard';
import { Roles } from 'src/modules/auth/decorators/roles.decorators';
import { TenantGuard } from 'src/common/guards/tenant-guard';
import { Tenant } from 'src/common/decorators/tenant-decorator';
import { CurrentUser } from 'src/modules/auth/decorators/current-user.decorator';
import { User } from 'src/modules/users/entities/user.entity';

@ApiTags('Reservations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, TenantGuard)
@Controller('companies/:companyId/reservations')
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @Post()
  @Roles('diner', 'company_admin', 'super_admin', 'kitchen', 'kitchen_admin')
  @ApiOperation({ summary: 'Create a new reservation or join waiting list' })
  @ApiResponse({ status: 201, description: 'Reservation created or added to waitlist' })
  create(
    @Body() createReservationDto: CreateReservationDto,
    @Tenant() companyId: number,
    @CurrentUser() user: User,
  ) {
    return this.reservationsService.createReservation(
      createReservationDto,
      user.id,
      companyId,
    );
  }

  @Get('me')
  @Roles('diner', 'company_admin', 'super_admin', 'kitchen', 'kitchen_admin')
  @ApiOperation({ summary: 'Get current user reservations' })
  findMyReservations(
    @Tenant() companyId: number,
    @CurrentUser() user: User,
  ) {
    return this.reservationsService.findMyReservations(user.id, companyId);
  }

  @Get()
  @Roles('company_admin', 'super_admin')
  @ApiOperation({ summary: 'Get all reservations (Admin only)' })
  findAll(@Tenant() companyId: number) {
    return this.reservationsService.findAll(companyId);
  }

  @Get('waitlist')
  @Roles('company_admin', 'super_admin')
  @ApiOperation({ summary: 'Get all waitlist entries (Admin only)' })
  findWaitlist(@Tenant() companyId: number) {
    return this.reservationsService.findWaitlistEntries(companyId);
  }
}
