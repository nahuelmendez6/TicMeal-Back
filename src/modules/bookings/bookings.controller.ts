import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpStatus,
  Get,
  Param,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { TenantGuard } from 'src/common/guards/tenant-guard';
import { CurrentUser } from 'src/modules/auth/decorators/current-user.decorator';
import { Tenant } from 'src/common/decorators/tenant-decorator';
import { User } from 'src/modules/users/entities/user.entity'; // Assuming User entity is here
import { Booking } from './entities/booking.entity';

@ApiTags('Bookings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new meal booking' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'The booking has been successfully created.',
    type: Booking,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input or no availability.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'MealShift or User not found.',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Tenant Access Denied or Observation conflict.',
  })
  async create(
    @Body() createBookingDto: CreateBookingDto,
    @CurrentUser() user: User,
    @Tenant() companyId: number,
  ): Promise<Booking> {
    return this.bookingsService.createBooking(
      createBookingDto,
      user.id,
      companyId,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Retrieve all bookings for the current tenant' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'A list of bookings.',
    type: [Booking],
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Tenant Access Denied.',
  })
  async findAll(@Tenant() companyId: number): Promise<Booking[]> {
    // This method needs to be implemented in bookings.service.ts
    // For now, returning an empty array or a dummy call
    return this.bookingsService.findAllBookings(companyId);
  }
}
