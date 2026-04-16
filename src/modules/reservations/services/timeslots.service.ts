import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Timeslot } from '../entities/timeslot.entity';
import { CreateTimeslotDto } from '../dto/create-timeslot.dto';
import { UpdateTimeslotDto } from '../dto/update-timeslot.dto';
import { TenantAwareRepository } from 'src/common/repository/tenant-aware.repository';

@Injectable()
export class TimeslotsService {
  constructor(
    @InjectRepository(Timeslot)
    private readonly timeslotRepository: Repository<Timeslot>,
  ) {}

  async create(createTimeslotDto: CreateTimeslotDto, companyId: number): Promise<Timeslot> {
    const timeslot = this.timeslotRepository.create({
      ...createTimeslotDto,
      companyId,
    });
    return this.timeslotRepository.save(timeslot);
  }

  async findAll(companyId: number, shiftId?: number): Promise<Timeslot[]> {
    const options: any = {};
    if (shiftId) {
      options.where = { shiftId };
    }
    return TenantAwareRepository.findAllByTenant(this.timeslotRepository, companyId, options);
  }

  async findOne(id: number, companyId: number): Promise<Timeslot> {
    const timeslot = await TenantAwareRepository.findOneByTenant(this.timeslotRepository, id, companyId);
    if (!timeslot) {
      throw new NotFoundException(`Timeslot with ID ${id} not found`);
    }
    return timeslot;
  }

  async update(id: number, updateTimeslotDto: UpdateTimeslotDto, companyId: number): Promise<Timeslot> {
    const timeslot = await this.findOne(id, companyId);
    Object.assign(timeslot, updateTimeslotDto);
    return this.timeslotRepository.save(timeslot);
  }

  async remove(id: number, companyId: number): Promise<void> {
    const timeslot = await this.findOne(id, companyId);
    await this.timeslotRepository.remove(timeslot);
  }
}
