import {
  Controller,
  Get,
  UseGuards,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { TenantGuard } from 'src/common/guards/tenant-guard';
import { Tenant } from 'src/common/decorators/tenant-decorator';
import { ProductionService } from './production.service';
import { PickingList } from '../entities/picking-list.entity';

@ApiTags('Production')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('production')
export class ProductionController {
  constructor(private readonly productionService: ProductionService) {}

  @Get('picking-lists/:date')
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
}
