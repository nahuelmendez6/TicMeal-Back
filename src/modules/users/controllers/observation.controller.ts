import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Delete,
  UseGuards,
  Req,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ObservationService } from '../services/observation.service';
import { Observation } from '../entities/observation.entity';
import { CreateUserDto } from '../dto/create.user.dto';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { Roles } from 'src/modules/auth/decorators/roles.decorators';
import { RolesGuard } from 'src/modules/auth/guards/roles.guard';
import { Tenant } from 'src/common/decorators/tenant-decorator';
import type { Request } from 'express';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('observations')
export class ObservationController {
  constructor(private readonly observationService: ObservationService) {}

  @Get()
  async list(@Req() req: Request) {
    return this.observationService.getAllObservations();
  }
}
