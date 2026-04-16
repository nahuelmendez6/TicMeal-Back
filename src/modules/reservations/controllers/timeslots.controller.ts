import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { TimeslotsService } from '../services/timeslots.service';
import { CreateTimeslotDto } from '../dto/create-timeslot.dto';
import { UpdateTimeslotDto } from '../dto/update-timeslot.dto';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/modules/auth/guards/roles.guard';
import { Roles } from 'src/modules/auth/decorators/roles.decorators';
import { TenantGuard } from 'src/common/guards/tenant-guard';
import { Tenant } from 'src/common/decorators/tenant-decorator';

@ApiTags('Timeslots')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, TenantGuard)
@Controller('companies/:companyId/timeslots')
export class TimeslotsController {
  constructor(private readonly timeslotsService: TimeslotsService) {}

  @Post()
  @Roles('company_admin', 'super_admin')
  @ApiOperation({ summary: 'Create a new pickup timeslot' })
  @ApiResponse({ status: 201, description: 'Timeslot created successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Tenant access denied' })
  create(
    @Body() createTimeslotDto: CreateTimeslotDto,
    @Tenant() companyId: number,
  ) {
    return this.timeslotsService.create(createTimeslotDto, companyId);
  }

  @Get()
  @ApiOperation({ summary: 'List all pickup timeslots for the company' })
  findAll(
    @Tenant() companyId: number,
    @Query('shiftId') shiftId?: number,
  ) {
    return this.timeslotsService.findAll(companyId, shiftId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get details of a specific timeslot' })
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @Tenant() companyId: number,
  ) {
    return this.timeslotsService.findOne(id, companyId);
  }

  @Patch(':id')
  @Roles('company_admin', 'super_admin')
  @ApiOperation({ summary: 'Update an existing timeslot' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateTimeslotDto: UpdateTimeslotDto,
    @Tenant() companyId: number,
  ) {
    return this.timeslotsService.update(id, updateTimeslotDto, companyId);
  }

  @Delete(':id')
  @Roles('company_admin', 'super_admin')
  @ApiOperation({ summary: 'Remove a timeslot' })
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Tenant() companyId: number,
  ) {
    return this.timeslotsService.remove(id, companyId);
  }
}
