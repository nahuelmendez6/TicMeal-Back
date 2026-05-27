import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  ParseIntPipe,
  UseGuards,
  ForbiddenException,
  Req,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { PurchasesService } from '../services/purchases.service';
import { CreatePurchaseOrderDto } from '../dto/create-purchase-order.dto';
import { ReceivePurchaseOrderDto } from '../dto/receive-purchase-order.dto';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/modules/auth/guards/roles.guard';
import { Roles } from 'src/modules/auth/decorators/roles.decorators';
import { Tenant } from 'src/common/decorators/tenant-decorator';
import { PurchaseOrder } from '../entities/purchase-order.entity';
import { PurchaseSuggestion } from '../entities/purchase-suggestion.entity';

@ApiTags('Purchases')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('purchases')
@Roles('company_admin', 'kitchen_admin')
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new purchase order' })
  @ApiResponse({ status: HttpStatus.CREATED, type: PurchaseOrder })
  async create(
    @Body() createDto: CreatePurchaseOrderDto,
    @Tenant() tenantId: number,
  ) {
    if (!tenantId) {
      throw new ForbiddenException('No se pudo determinar el tenant.');
    }
    return this.purchasesService.create(createDto, tenantId);
  }

  @Get()
  @ApiOperation({ summary: 'Get all purchase orders for the tenant' })
  @ApiResponse({ status: HttpStatus.OK, type: [PurchaseOrder] })
  async findAll(@Tenant() tenantId: number) {
    if (!tenantId) {
      throw new ForbiddenException('No se pudo determinar el tenant.');
    }
    return this.purchasesService.findAll(tenantId);
  }

  @Get('suggestions')
  @ApiOperation({ summary: 'Get all pending purchase suggestions' })
  @ApiResponse({ status: HttpStatus.OK, type: [PurchaseSuggestion] })
  async findAllSuggestions(@Tenant() tenantId: number) {
    if (!tenantId) {
      throw new ForbiddenException('No se pudo determinar el tenant.');
    }
    return this.purchasesService.findAllSuggestions(tenantId);
  }

  @Post('suggestions/convert')
  @ApiOperation({
    summary: 'Convert selected suggestions into purchase orders',
  })
  @ApiResponse({ status: HttpStatus.CREATED, type: [PurchaseOrder] })
  async convertSuggestions(
    @Body('suggestionIds') suggestionIds: number[],
    @Tenant() tenantId: number,
  ) {
    if (!tenantId) {
      throw new ForbiddenException('No se pudo determinar el tenant.');
    }
    return this.purchasesService.convertSuggestionsToPO(
      suggestionIds,
      tenantId,
    );
  }

  @Post('suggestions/reject')
  @ApiOperation({ summary: 'Reject selected purchase suggestions' })
  @ApiResponse({ status: HttpStatus.OK })
  async rejectSuggestions(
    @Body('suggestionIds') suggestionIds: number[],
    @Tenant() tenantId: number,
  ) {
    if (!tenantId) {
      throw new ForbiddenException('No se pudo determinar el tenant.');
    }
    await this.purchasesService.rejectSuggestions(suggestionIds, tenantId);
    return { message: 'Sugerencias rechazadas correctamente.' };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific purchase order' })
  @ApiResponse({ status: HttpStatus.OK, type: PurchaseOrder })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @Tenant() tenantId: number,
  ) {
    if (!tenantId) {
      throw new ForbiddenException('No se pudo determinar el tenant.');
    }
    return this.purchasesService.findOne(id, tenantId);
  }

  @Post(':id/receive')
  @ApiOperation({ summary: 'Mark a purchase order as received and update stock' })
  @ApiResponse({ status: HttpStatus.OK, type: PurchaseOrder })
  async receive(
    @Param('id', ParseIntPipe) id: number,
    @Tenant() tenantId: number,
    @Req() req: any,
  ) {
    if (!tenantId) {
      throw new ForbiddenException('No se pudo determinar el tenant.');
    }
    const { id: userId } = req.user;
    return this.purchasesService.receive(id, tenantId, userId);
  }
}
