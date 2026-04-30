import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Invitation } from './entities/invitation.entity';
import { UsersService } from './services/user.service';
import { InvitationsService } from './services/invitations.service';
import { ObservationService } from '../users/services/observation.service';
import { UsersController } from './controllers/users.controllers';
import { ObservationController } from './controllers/observation.controller';
import { Observation } from '../users/entities/observation.entity';
import { Company } from '../companies/entities/company.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Company, Observation, Invitation])],
  providers: [UsersService, ObservationService, InvitationsService],
  controllers: [UsersController, ObservationController],
  exports: [UsersService, ObservationService, InvitationsService],
})
export class UsersModule {}
