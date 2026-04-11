import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, LessThanOrEqual, MoreThanOrEqual, DataSource } from 'typeorm';

import { Menu, MenuStatus } from './entities/menu.entity';
import { MenuDay } from './entities/menu-day.entity';
import { MenuOption } from './entities/menu-option.entity';
import { Shift } from '../shift/entities/shift.entity';

import { CreateMenuDto } from './dto/create-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';
import { AddMenuOptionDto } from './dto/add-menu-option.dto';

@Injectable()
export class MenusService {
  constructor(
    @InjectRepository(Menu)
    private readonly menuRepository: Repository<Menu>,
    @InjectRepository(MenuDay)
    private readonly menuDayRepository: Repository<MenuDay>,
    @InjectRepository(MenuOption)
    private readonly menuOptionRepository: Repository<MenuOption>,
    @InjectRepository(Shift)
    private readonly shiftRepository: Repository<Shift>,
    private readonly dataSource: DataSource,
  ) {}

  async create(createMenuDto: CreateMenuDto, companyId: number): Promise<Menu> {
    const menu = this.menuRepository.create({
      ...createMenuDto,
      companyId,
    });
    return this.menuRepository.save(menu);
  }

  async findAll(companyId: number): Promise<Menu[]> {
    return this.menuRepository.find({ where: { companyId } });
  }

  async findOne(id: string, companyId: number): Promise<Menu> {
    const menu = await this.menuRepository.findOne({
      where: { id, companyId },
      relations: ['menuDays', 'menuDays.menuOptions', 'menuDays.menuOptions.shifts'],
    });

    if (!menu) {
      throw new NotFoundException(`Menu with ID "${id}" not found for this company.`);
    }
    return menu;
  }

  async findPublishedForUser(companyId: number): Promise<Menu[]> {
    const today = new Date();
    return this.menuRepository.find({
      where: {
        companyId,
        status: MenuStatus.PUBLISHED,
        startDate: LessThanOrEqual(today),
        endDate: MoreThanOrEqual(today),
      },
      relations: ['menuDays', 'menuDays.menuOptions', 'menuDays.menuOptions.shifts'],
      order: {
        startDate: 'ASC',
        menuDays: { date: 'ASC' },
      },
    });
  }

  async update(id: string, updateMenuDto: UpdateMenuDto, companyId: number): Promise<Menu> {
    const menu = await this.findOne(id, companyId);
    const updatedMenu = this.menuRepository.merge(menu, updateMenuDto);
    return this.menuRepository.save(updatedMenu);
  }

  async addOption(addMenuOptionDto: AddMenuOptionDto, companyId: number): Promise<MenuOption> {
    const { date, productId, shiftIds } = addMenuOptionDto;

    return this.dataSource.transaction(async (manager) => {
      const shiftRepo = manager.getRepository(Shift);
      const menuRepo = manager.getRepository(Menu);
      const menuDayRepo = manager.getRepository(MenuDay);
      const menuOptionRepo = manager.getRepository(MenuOption);

      const shifts = await shiftRepo.find({
        where: { id: In(shiftIds), companyId },
      });

      if (shifts.length !== shiftIds.length) {
        throw new BadRequestException('One or more shifts are invalid or do not belong to this company.');
      }

      const menu = await menuRepo.findOne({
        where: {
          companyId,
          startDate: LessThanOrEqual(new Date(date)),
          endDate: MoreThanOrEqual(new Date(date)),
        },
      });

      if (!menu) {
        throw new NotFoundException(`No active menu found for date ${date}`);
      }

      let menuDay = await menuDayRepo.findOne({
        where: { date: new Date(date), menuId: menu.id, companyId },
      });

      if (!menuDay) {
        menuDay = menuDayRepo.create({
          date: new Date(date),
          menu,
          companyId,
        });
        await menuDayRepo.save(menuDay);
      }

      const newOption = menuOptionRepo.create({
        productId,
        shifts,
        menuDay,
        companyId,
      });

      return menuOptionRepo.save(newOption);
    });
  }

  async remove(id: string, companyId: number): Promise<void> {
    const menu = await this.findOne(id, companyId);
    await this.menuRepository.remove(menu);
  }
}
