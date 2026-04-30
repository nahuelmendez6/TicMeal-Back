import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, LessThanOrEqual, MoreThanOrEqual, DataSource } from 'typeorm';

import { Menu, MenuStatus } from './entities/menu.entity';
import { MenuDay } from './entities/menu-day.entity';
import { MenuOption } from './entities/menu-option.entity';
import { Shift } from '../shift/entities/shift.entity';
import { User } from '../users/entities/user.entity';
import { MenuItemService } from '../stock/services/menu-item.service';
import { CompatibilityUtil } from 'src/common/utils/compatibility.util';

import { CreateMenuDto } from './dto/create-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';
import { AddMenuOptionDto } from './dto/add-menu-option.dto';

/**
 * Service responsible for managing menus and their associated days and options.
 * It handles creation, retrieval, updates, and deletion of menu data,
 * ensuring multi-tenancy by filtering operations based on companyId.
 */
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
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly menuItemService: MenuItemService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Creates a new menu for a specific company.
   *
   * @param createMenuDto - Data transfer object for creating a menu.
   * @param companyId - The ID of the company creating the menu.
   * @returns A promise that resolves to the newly created Menu entity.
   */
  async create(createMenuDto: CreateMenuDto, companyId: number): Promise<Menu> {
    const menu = this.menuRepository.create({
      ...createMenuDto,
      companyId,
    });
    return this.menuRepository.save(menu);
  }

  /**
   * Retrieves all menus for a given company.
   *
   * @param companyId - The ID of the company.
   * @returns A promise that resolves to an array of Menu entities.
   */
  async findAll(companyId: number): Promise<Menu[]> {
    return this.menuRepository.find({ where: { companyId } });
  }

  /**
   * Retrieves a single menu by its ID for a specific company, including its days, options, and associated shifts.
   *
   * @param id - The ID of the menu to retrieve.
   * @param companyId - The ID of the company.
   * @returns A promise that resolves to the found Menu entity.
   * @throws NotFoundException if the menu does not exist or does not belong to the company.
   */
  async findOne(id: string, companyId: number): Promise<Menu> {
    const menu = await this.menuRepository.findOne({
      where: { id, companyId },
      relations: [
        'menuDays',
        'menuDays.menuOptions',
        'menuDays.menuOptions.shifts',
        'menuDays.menuOptions.menuItem',
      ],
    });

    if (!menu) {
      throw new NotFoundException(`Menu with ID "${id}" not found for this company.`);
    }
    return menu;
  }

  /**
   * Retrieves all published menus that are currently active for a specific company.
   * These menus include their days, options, and associated shifts, ordered by start date.
   * For the provided userId, it calculates compatibility flags for each option.
   *
   * @param companyId - The ID of the company.
   * @param userId - Optional ID of the user to calculate compatibility for.
   * @returns A promise that resolves to an array of published Menu entities with compatibility info.
   */
  async findPublishedForUser(
    companyId: number,
    userId?: number,
    strictFilter: boolean = false,
  ): Promise<any[]> {
    const today = new Date();
    const menus = await this.menuRepository.find({
      where: {
        companyId,
        status: MenuStatus.PUBLISHED,
        startDate: LessThanOrEqual(today),
        endDate: MoreThanOrEqual(today),
      },
      relations: [
        'menuDays',
        'menuDays.menuOptions',
        'menuDays.menuOptions.shifts',
        'menuDays.menuOptions.menuItem',
        'menuDays.menuOptions.menuItem.observations',
        'menuDays.menuOptions.menuItem.recipeIngredients',
        'menuDays.menuOptions.menuItem.recipeIngredients.ingredient',
        'menuDays.menuOptions.menuItem.recipeIngredients.ingredient.observations',
      ],
      order: {
        startDate: 'ASC',
        menuDays: { date: 'ASC' },
      },
    });

    if (!userId) return menus;

    const user = await this.userRepository.findOne({
      where: { id: userId, companyId },
      relations: ['observations'],
    });

    if (!user) return menus;

    // Inject compatibility flags and filter if requested
    return menus
      .map((menu) => ({
        ...menu,
        menuDays: menu.menuDays
          .map((day) => ({
            ...day,
            menuOptions: day.menuOptions
              .map((option) => {
                const aggregatedObs =
                  this.menuItemService.getAggregatedObservations(
                    option.menuItem,
                  );
                const compatibility = CompatibilityUtil.evaluate(
                  user.observations || [],
                  aggregatedObs,
                );
                return {
                  ...option,
                  isCompatible: compatibility.isCompatible,
                  conflictingObservations: compatibility.conflicts,
                };
              })
              .filter((option) => !strictFilter || option.isCompatible),
          }))
          .filter((day) => day.menuOptions.length > 0),
      }))
      .filter((menu) => menu.menuDays.length > 0);
  }

  /**
   * Retrieves all menu days and their associated options for a specific menu.
   *
   * @param menuId - The ID of the menu.
   * @param companyId - The ID of the company.
   * @param userId - Optional ID of the user to calculate compatibility for.
   * @returns A promise that resolves to an array of MenuDay entities with compatibility info.
   * @throws NotFoundException if the menu does not exist or does not belong to the company.
   */
  async getMenuOptionsByDay(
    menuId: string,
    companyId: number,
    userId?: number,
  ): Promise<any[]> {
    // Ensure the menu exists and belongs to the company
    const menu = await this.menuRepository.findOne({
      where: { id: menuId, companyId },
    });

    if (!menu) {
      throw new NotFoundException(
        `Menu with ID "${menuId}" not found for this company.`,
      );
    }

    const days = await this.menuDayRepository.find({
      where: { menuId, companyId },
      relations: [
        'menuOptions',
        'menuOptions.menuItem',
        'menuOptions.menuItem.observations',
        'menuOptions.menuItem.recipeIngredients',
        'menuOptions.menuItem.recipeIngredients.ingredient',
        'menuOptions.menuItem.recipeIngredients.ingredient.observations',
        'menuOptions.shifts',
      ],
      order: { date: 'ASC' },
    });

    if (!userId) return days;

    const user = await this.userRepository.findOne({
      where: { id: userId, companyId },
      relations: ['observations'],
    });

    if (!user) return days;

    return days.map((day) => ({
      ...day,
      menuOptions: day.menuOptions.map((option) => {
        const aggregatedObs = this.menuItemService.getAggregatedObservations(
          option.menuItem,
        );
        const compatibility = CompatibilityUtil.evaluate(
          user.observations || [],
          aggregatedObs,
        );
        return {
          ...option,
          isCompatible: compatibility.isCompatible,
          conflictingObservations: compatibility.conflicts,
        };
      }),
    }));
  }

  /**
   * Updates an existing menu for a specific company.
   *
   * @param id - The ID of the menu to update.
   * @param updateMenuDto - Data transfer object with the updated menu data.
   * @param companyId - The ID of the company.
   * @returns A promise that resolves to the updated Menu entity.
   * @throws NotFoundException if the menu does not exist or does not belong to the company.
   */
  async update(id: string, updateMenuDto: UpdateMenuDto, companyId: number): Promise<Menu> {
    const menu = await this.findOne(id, companyId); // Ensures menu exists and belongs to tenant
    const updatedMenu = this.menuRepository.merge(menu, updateMenuDto);
    return this.menuRepository.save(updatedMenu);
  }

  /**
   * Adds a new menu option to a specific menu day for a company.
   * This operation is transactional, ensuring data consistency.
   * It will find an existing menu day or create a new one if it doesn't exist for the given date.
   *
   * @param addMenuOptionDto - Data transfer object containing the menu option details, including date and associated shift IDs.
   * @param companyId - The ID of the company.
   * @returns A promise that resolves to the newly created MenuOption entity.
   * @throws BadRequestException if any shift IDs are invalid or do not belong to the company.
   * @throws NotFoundException if no active menu is found for the specified date.
   */
  async addOption(addMenuOptionDto: AddMenuOptionDto, companyId: number): Promise<MenuOption> {
    const { date, menuItemId, shiftIds } = addMenuOptionDto;

    return this.dataSource.transaction(async (manager) => {
      const shiftRepo = manager.getRepository(Shift);
      const menuRepo = manager.getRepository(Menu);
      const menuDayRepo = manager.getRepository(MenuDay);
      const menuOptionRepo = manager.getRepository(MenuOption);

      // Validate and retrieve shifts
      const shifts = await shiftRepo.find({
        where: { id: In(shiftIds), companyId },
      });

      if (shifts.length !== shiftIds.length) {
        throw new BadRequestException('One or more shifts are invalid or do not belong to this company.');
      }

      // Find an active menu for the given date
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

      // Find or create the MenuDay
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

      // Create and save the new MenuOption
      const newOption = menuOptionRepo.create({
        menuItemId,
        shifts,
        menuDay,
        companyId,
      });

      return menuOptionRepo.save(newOption);
    });
  }

  /**
   * Removes a specific menu option by its ID for a company.
   *
   * @param optionId - The ID of the menu option to remove.
   * @param companyId - The ID of the company.
   * @returns A promise that resolves when the option is successfully removed.
   * @throws NotFoundException if the menu option does not exist or does not belong to the company.
   */
  async removeOption(optionId: string, companyId: number): Promise<void> {
    const option = await this.menuOptionRepository.findOne({
      where: { id: optionId, companyId },
    });

    if (!option) {
      throw new NotFoundException(
        `Menu option with ID "${optionId}" not found for this company.`,
      );
    }

    await this.menuOptionRepository.remove(option);
  }

  /**
   * Removes a menu by its ID for a specific company.
   *
   * @param id - The ID of the menu to remove.
   * @param companyId - The ID of the company.
   * @returns A promise that resolves when the menu is successfully removed.
   * @throws NotFoundException if the menu does not exist or does not belong to the company.
   */
  async remove(id: string, companyId: number): Promise<void> {
    const menu = await this.findOne(id, companyId); // Ensures menu exists and belongs to tenant
    await this.menuRepository.remove(menu);
  }
}
