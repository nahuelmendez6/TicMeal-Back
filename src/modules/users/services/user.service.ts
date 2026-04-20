import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { TenantAwareRepository } from 'src/common/repository/tenant-aware.repository';
import { Repository, DeepPartial, Like, In } from 'typeorm';
import { User } from '../entities/user.entity';
import { Company } from 'src/modules/companies/entities/company.entity';
import { CreateUserDto } from '../dto/create.user.dto';
import { UpdateUserDto } from '../dto/update.user.dto';
import { Observation } from '../entities/observation.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
    @InjectRepository(Observation)
    private readonly observationRepo: Repository<Observation>,
  ) {}

  async createUser(dto: CreateUserDto): Promise<User> {
    const salt = await bcrypt.genSalt();
    const hashedPassword = dto.password
      ? await bcrypt.hash(dto.password, salt)
      : undefined;

    // Si es un 'diner' y no tiene username, generarlo.
    if (dto.role === 'diner' && !dto.username) {
      if (!dto.companyId || !dto.firstName) {
        throw new BadRequestException(
          'Se requiere companyId y firstName para registrar un diner.',
        );
      }
      const company = await this.companyRepo.findOneBy({ id: dto.companyId });
      if (!company) {
        throw new NotFoundException(
          `Compañía con ID ${dto.companyId} no encontrada.`,
        );
      }
      dto.username = await this.generateUniqueUsername(
        dto.firstName,
        dto.companyId,
        company.name,
      );
    }

    const { observationIds, ...userDto } = dto;

    const partial: DeepPartial<User> = {
      ...userDto,
      password: hashedPassword,
    };

    const user = this.userRepo.create(partial);

    if (dto.companyId) {
      const companyRef = await this.companyRepo.findOne({
        where: { id: dto.companyId },
      });
      if (companyRef) user.company = companyRef;
    }

    if (observationIds && observationIds.length > 0) {
      const observations = await this.observationRepo.findBy({
        id: In(observationIds),
      });
      user.observations = observations;
    }

    return this.userRepo.save(user);
  }

  async findAllForTenant(companyId: number): Promise<User[]> {
    return TenantAwareRepository.createTenantQueryBuilder(
      this.userRepo,
      companyId,
      'user',
    )
      .leftJoinAndSelect('user.company', 'company')
      .leftJoinAndSelect('user.observations', 'observations')
      .getMany();
  }

  async updateUser(
    id: number,
    dto: UpdateUserDto,
    companyId?: number,
  ): Promise<User> {
    const user = await this.userRepo.findOne({
      where: { id, ...(companyId && { company: { id: companyId } }) },
      relations: ['observations'],
    });

    if (!user) {
      throw new NotFoundException(
        `Usuario con ID ${id} no encontrado o no pertenece a tu compañía.`,
      );
    }

    // Hashear contraseña si se provee una nueva
    if (dto.password) {
      const salt = await bcrypt.genSalt();
      dto.password = await bcrypt.hash(dto.password, salt);
    }

    const { observationsIds, ...userDto } = dto;

    // Actualizar observaciones si se proveen los IDs
    if (observationsIds !== undefined) {
      if (observationsIds.length > 0) {
        const observations = await this.observationRepo.findBy({
          id: In(observationsIds),
        });
        user.observations = observations;
      } else {
        user.observations = []; // Vaciar observaciones si se envía un array vacío
      }
    }

    const updatedUser = this.userRepo.merge(user, userDto);
    return this.userRepo.save(updatedUser);
  }

  /**
   * Busca todos los usuarios (solo para super_admin).
   * En producción, considerar remover este método o agregar validación de rol.
   */
  async findAll(): Promise<User[]> {
    return this.userRepo.find({ relations: ['company'] });
  }

  /**
   * Busca un usuario por ID.
   * Para operaciones multi-tenant, usar findByIdForTenant.
   */
  async findById(id: number): Promise<User | null> {
    return this.userRepo.findOne({ where: { id }, relations: ['company'] });
  }

  /**
   * Busca un usuario por ID verificando que pertenezca al tenant.
   */
  async findByIdForTenant(id: number, companyId: number): Promise<User | null> {
    return TenantAwareRepository.findOneByTenant(
      this.userRepo,
      id,
      companyId,
      undefined, // Pass undefined for options
      'user', // Pass 'user' as the alias
    );
  }

  /**
   * Busca un usuario por email.
   * Para operaciones multi-tenant, usar findByEmailForTenant.
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { email }, relations: ['company'] });
  }

  /**
   * Busca un usuario por email verificando que pertenezca al tenant.
   */
  async findByEmailForTenant(
    email: string,
    companyId: number,
  ): Promise<User | null> {
    return this.userRepo.findOne({
      where: { email, companyId },
      relations: ['company'],
    });
  }

  /**
   * Busca un usuario por username.
   * Para operaciones multi-tenant, usar findByUsernameForTenant.
   */
  async findByUsername(username: string) {
    return this.userRepo.findOne({
      where: { username },
      relations: ['company'],
    });
  }

  /**
   * Busca un usuario por username verificando que pertenezca al tenant.
   */
  async findByUsernameForTenant(username: string, companyId: number) {
    return this.userRepo.findOne({
      where: { username, companyId },
      relations: ['company'],
    });
  }

  /**
   * Elimina un usuario por ID.
   * Para operaciones multi-tenant, usar removeForTenant.
   */
  async remove(id: number): Promise<void> {
    await this.userRepo.delete(id);
  }

  /**
   * Elimina un usuario verificando que pertenezca al tenant.
   */
  async removeForTenant(id: number, companyId: number): Promise<boolean> {
    const belongs = await TenantAwareRepository.belongsToTenant(
      this.userRepo,
      id,
      companyId,
    );
    if (!belongs) {
      throw new ForbiddenException(
        'No tienes permiso para eliminar este usuario',
      );
    }
    await this.userRepo.delete(id);
    return true;
  }

  async validatePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  async generateUniqueUsername(
    firstName: string,
    companyId: number,
    companyName: string,
  ): Promise<string> {
    const existingUsers = await this.userRepo.find({
      where: {
        company: { id: companyId },
        username: Like(`${firstName}%@${companyName}`),
      },
      select: ['username'],
    });

    const usedNumbers = existingUsers.map((u) => {
      const match = u.username.match(
        new RegExp(`^${firstName}(\\d*)@${companyName}$`),
      );
      return match && match[1] ? parseInt(match[1]) : 0;
    });

    let suffix = 1;
    while (usedNumbers.includes(suffix)) suffix++;

    return `${firstName}${suffix}@${companyName}`.toLowerCase();
  }

  async validatePin(pin: string, hash: string): Promise<boolean> {
    return bcrypt.compare(pin, hash);
  }
}
