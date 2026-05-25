import {
  Controller,
  Get,
  UseGuards,
  HttpStatus,
  Param,
  Post,
  Body,
  Patch,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/modules/auth/guards/roles.guard';
import { Roles } from 'src/modules/auth/decorators/roles.decorators';
import { TenantGuard } from 'src/common/guards/tenant-guard';
import { Tenant } from 'src/common/decorators/tenant-decorator';
import { ProductionService } from './production.service';
import { PickingList } from '../entities/picking-list.entity';
import { UpdatePickedQuantityDto } from '../dto/update-picked-quantity.dto';
import { CurrentUser } from 'src/modules/auth/decorators/current-user.decorator';
import { User } from 'src/modules/users/entities/user.entity';

@ApiTags('Production')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, TenantGuard)
@Controller('production')
export class ProductionController {
  constructor(private readonly productionService: ProductionService) {}

  @Get('picking-lists/:date')
  @Roles('kitchen', 'kitchen_admin', 'super_admin', 'company_admin')
  @ApiOperation({
    summary: 'Retrieve picking list for a specific date and current tenant',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'The picking list for the specified date.',
    type: PickingList,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Picking list not found for the given date.',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Tenant Access Denied.',
  })
  async getPickingList(
    @Param('date') date: string,
    @Tenant() companyId: number,
  ): Promise<PickingList> {
    return this.productionService.getPickingListByDate(companyId, date);
  }

  @Post('trigger-plan-manual/:date')
  @Roles('kitchen_admin', 'super_admin', 'company_admin')
  @ApiOperation({
    summary:
      'Manually trigger the production plan generation for a specific date (Admin only)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Production plan generation initiated successfully.',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Tenant Access Denied.',
  })
  async triggerProductionPlanManual(
    @Param('date') date: string,
    @Tenant() companyId: number,
  ): Promise<{ message: string }> {
    // This method will directly call the production service's internal logic
    await this.productionService.handleProductionPlanManual(companyId, date);
    return {
      message: `Manual production plan for ${date} triggered for company ${companyId}.`,
    };
  }

  @Patch('picking-lists/items/:itemId')
  @Roles('kitchen', 'kitchen_admin', 'super_admin', 'company_admin')
  @ApiOperation({ summary: 'Update picked quantity for a specific item' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Item updated successfully.' })
  async updatePickedQuantity(
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() updateDto: UpdatePickedQuantityDto,
    @Tenant() companyId: number,
  ) {
    return this.productionService.updatePickedQuantity(companyId, itemId, updateDto);
  }

  @Post('picking-lists/:id/finalize')
  @Roles('kitchen', 'kitchen_admin', 'super_admin', 'company_admin')
  @ApiOperation({ summary: 'Finalize picking list and deduct stock' })
  @ApiResponse({ status: HttpStatus.OK, description: 'List finalized and stock deducted.' })
  async finalizePickingList(
    @Param('id', ParseIntPipe) id: number,
    @Tenant() companyId: number,
    @CurrentUser() user: User,
  ) {
    return this.productionService.finalizePickingList(companyId, id, user);
  }
}
