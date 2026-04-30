import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Patch,
  Delete,
  UseGuards,
  Req,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { UsersService } from '../services/user.service';
import { InvitationsService } from '../services/invitations.service';
import { CreateUserDto } from '../dto/create.user.dto';
import { CreateInvitationDto } from '../dto/create-invitation.dto';
import { UpdateUserDto } from '../dto/update.user.dto';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { Roles } from 'src/modules/auth/decorators/roles.decorators';
import { RolesGuard } from 'src/modules/auth/guards/roles.guard';
import { Tenant } from 'src/common/decorators/tenant-decorator';
import type { Request } from 'express';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Roles('company_admin', 'super_admin')
  @Post('create')
  async create(
    @Body() dto: CreateUserDto,
    @Tenant() tenantId: number | undefined,
    @Req() req: Request,
  ) {
    const user: any = (req as any).user;

    // Si no es super_admin, usar el tenantId del usuario autenticado
    if (user.role !== 'super_admin') {
      if (!tenantId) {
        throw new ForbiddenException('No se pudo determinar el tenant');
      }
      (dto as any).companyId = tenantId;
    }

    return this.usersService.createUser(dto as any);
  }

  @Get()
  async list(@Tenant() tenantId: number | undefined, @Req() req: Request) {
    const user: any = (req as any).user;

    // Los super_admin pueden ver todos los usuarios
    if (user.role === 'super_admin') {
      return this.usersService.findAll();
    }

    // Los demás solo ven usuarios de su tenant
    if (!tenantId) {
      throw new ForbiddenException('No se pudo determinar el tenant');
    }

    return this.usersService.findAllForTenant(tenantId);
  }

  @Get(':id')
  async getById(
    @Param('id') id: string,
    @Tenant() tenantId: number | undefined,
    @Req() req: Request,
  ) {
    const userReq: any = (req as any).user;

    // Los super_admin pueden ver cualquier usuario
    if (userReq.role === 'super_admin') {
      const found = await this.usersService.findById(Number(id));
      if (!found) {
        throw new NotFoundException('Usuario no encontrado');
      }
      return found;
    }

    // Los demás solo pueden ver usuarios de su tenant
    if (!tenantId) {
      throw new ForbiddenException('No se pudo determinar el tenant');
    }

    const found = await this.usersService.findByIdForTenant(
      Number(id),
      tenantId,
    );
    if (!found) {
      throw new NotFoundException('Usuario no encontrado o sin permisos');
    }

    return found;
  }

  @Roles('company_admin', 'super_admin')
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @Tenant() tenantId: number | undefined,
    @Req() req: Request,
  ) {
    const userReq: any = (req as any).user;

    // Los super_admin pueden editar cualquier usuario, los company_admin solo los de su tenant.
    const targetTenantId =
      userReq.role === 'super_admin' ? undefined : tenantId;

    if (userReq.role !== 'super_admin' && !targetTenantId) {
      throw new ForbiddenException('No se pudo determinar el tenant');
    }

    return this.usersService.updateUser(Number(id), dto, targetTenantId);
  }

  @Roles('company_admin', 'super_admin')
  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @Tenant() tenantId: number | undefined,
    @Req() req: Request,
  ) {
    const userReq: any = (req as any).user;

    // Los super_admin pueden eliminar cualquier usuario
    if (userReq.role === 'super_admin') {
      await this.usersService.remove(Number(id));
      return { deleted: true };
    }

    // Los demás solo pueden eliminar usuarios de su tenant
    if (!tenantId) {
      throw new ForbiddenException('No se pudo determinar el tenant');
    }

    await this.usersService.removeForTenant(Number(id), tenantId);
    return { deleted: true };
  }

  @Get('profile/me')
  async profile(@Req() req: Request) {
    const user: any = (req as any).user;
    const found = await this.usersService.findById(user.id);
    if (!found) {
      throw new NotFoundException('Usuario no encontrado');
    }
    return found;
  }

  @Post('profile/complete')
  async completeProfile(
    @Body() dto: UpdateUserDto,
    @Req() req: Request,
    @Tenant() tenantId: number,
  ) {
    const userReq: any = (req as any).user;
    return this.usersService.completeProfile(userReq.id, dto, tenantId);
  }
}
