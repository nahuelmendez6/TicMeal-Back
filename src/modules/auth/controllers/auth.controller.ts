import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AuthService } from '../services/auth.service';
import { CreateUserDto } from 'src/modules/users/dto/create.user.dto';
import { CreateCompanyDto } from 'src/modules/companies/dto/create.company.dto';
import { LoginDto } from '../dto/login.dto';
import { RegisterInvitationDto } from '../dto/register-invitation.dto';
import { Public, Roles } from '../decorators/roles.decorators';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { User } from 'src/modules/users/entities/user.entity';
import { CurrentUser } from '../decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ===================================================
  // Registro de empresa + admin (público)
  // ===================================================

  @Public()
  @Post('register-company')
  async registerCompany(
    @Body() body: { company: CreateCompanyDto; admin: CreateUserDto },
  ) {
    return this.authService.registerCompany(body.company, body.admin);
  }

  // ===================================================
  // Login (público)
  // ===================================================

  @Public()
  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto.username, dto.password);
  }

  @Public()
  @Post('register-invitation')
  async registerInvitation(@Body() dto: RegisterInvitationDto) {
    return this.authService.registerWithInvitation(dto);
  }

  // ===================================================
  //  Crear usuarios internos (solo admin de empresa)
  // ===================================================
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('company_admin', 'super_admin')
  @Post('register-diner')
  async registerDiner(
    @CurrentUser() currentUser: User,
    @Body() dto: CreateUserDto,
  ) {
    return this.authService.registerDiner(dto, currentUser);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('company_admin', 'super_admin')
  @Post('register-kitchen-admin')
  async registerKitchenAdmin(
    @CurrentUser() currentUser: User,
    @Body() dto: CreateUserDto,
  ) {
    return this.authService.registerKitchenAdmin(dto, currentUser);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin') // Solo un super_admin puede crear otros company_admin
  @Post('register-company-admin')
  async registerCompanyAdmin(
    @CurrentUser() currentUser: User,
    @Body() dto: CreateUserDto,
  ) {
    return this.authService.registerCompanyAdmin(dto, currentUser);
  }

  @Public()
  @Post('verify-registration')
  async verifyRegistration(@Body() body: { email: string; code: string }) {
    return this.authService.verifyRegistration(body.email, body.code);
  }
}
