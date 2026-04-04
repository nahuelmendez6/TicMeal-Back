import { Injectable, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Ingredient } from '../entities/ingredient.entity';
import { CreateIngredientDto } from '../dto/create-ingredient.dto';
import { IngredientCategory } from '../entities/ingredient-category.entity';
import { UpdateIngredientDto } from '../dto/update-ingredient.dto';
import { IngredientCategoryService } from './ingredient-category.service';
import { StockService } from './stock.service';
import { MovementType } from '../enums/enums';
import { MenuItemService } from './menu-item.service';

@Injectable()
export class IngredientService {
  constructor(
    @InjectRepository(Ingredient)
    private readonly ingredientRepo: Repository<Ingredient>,
    private readonly ingredientCategoryService: IngredientCategoryService,
    private readonly stockService: StockService,
    private readonly dataSource: DataSource,
    @Inject(forwardRef(() => MenuItemService))
    private readonly menuItemService: MenuItemService,
  ) {}

  async create(
    createDto: CreateIngredientDto,
    companyId: number,
    userId: number,
  ): Promise<Ingredient> {
    const {
      categoryId,
      // quantityInStock is no longer managed here
      ...ingredientData
    } = createDto;

    if (categoryId) {
      await this.ingredientCategoryService.validateCategoryAvailability(
        categoryId,
        companyId,
      );
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const newIngredient = queryRunner.manager.create(Ingredient, {
        ...ingredientData,
        companyId: companyId,
        category: categoryId ? { id: categoryId } : null,
      });
      const savedIngredient = await queryRunner.manager.save(newIngredient);

      // Initial stock must now be added via an explicit stock movement, not on creation.

      await queryRunner.commitTransaction();
      return this.findOneForTenant(savedIngredient.id, companyId);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async findAllForTenant(companyId: number): Promise<Ingredient[]> {
    const ingredients = await this.ingredientRepo.find({
      where: { companyId },
      relations: ['category', 'lots'],
      order: { name: 'ASC' },
    });

    // Calculate stock for each ingredient
    for (const ingredient of ingredients) {
      ingredient.quantityInStock = ingredient.lots
        ? ingredient.lots.reduce((sum, lot) => sum + lot.quantity, 0)
        : 0;
    }

    return ingredients;
  }

  async findOneForTenant(id: number, companyId: number): Promise<Ingredient> {
    const ingredient = await this.ingredientRepo.findOne({
      where: { id, companyId },
      relations: ['category', 'lots'],
    });

    if (!ingredient) {
      throw new NotFoundException(
        `Ingrediente con ID ${id} no encontrado o sin permisos.`,
      );
    }

    // Calculate stock from lots
    ingredient.quantityInStock = ingredient.lots
      ? ingredient.lots.reduce((sum, lot) => sum + lot.quantity, 0)
      : 0;

    return ingredient;
  }

  async update(
    id: number,
    updateDto: UpdateIngredientDto,
    companyId: number,
    userId: number,
  ): Promise<Ingredient> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const ingredientToUpdate = await queryRunner.manager.findOne(Ingredient, {
        where: { id, companyId },
      });

      if (!ingredientToUpdate) {
        throw new NotFoundException(`Ingrediente con ID ${id} no encontrado.`);
      }

      const {
        // quantityInStock is no longer managed here
        categoryId,
        ...updateData
      } = updateDto;

      queryRunner.manager.merge(Ingredient, ingredientToUpdate, updateData);

      ingredientToUpdate.companyId = companyId;
      if (updateDto.hasOwnProperty('categoryId')) {
        if (categoryId) {
          await this.ingredientCategoryService.validateCategoryAvailability(
            categoryId,
            companyId,
          );
          ingredientToUpdate.category = {
            id: categoryId,
          } as IngredientCategory;
        } else {
          ingredientToUpdate.category = null;
        }
      }
      await queryRunner.manager.save(ingredientToUpdate);

      // The block that caused the error has been removed.
      // Stock adjustments must be done via explicit calls to StockService.

      await queryRunner.commitTransaction();
      if (updateDto.nutritionalInfo) {
        await this.menuItemService.recalculateNutritionalInfoForIngredient(id);
      }
      return this.findOneForTenant(id, companyId);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async remove(id: number, companyId: number): Promise<boolean> {
    const result = await this.ingredientRepo.delete({ id, companyId });
    if (result.affected === 0) {
      throw new NotFoundException(
        `Ingrediente con ID ${id} no encontrado en su alcance.`,
      );
    }
    return true;
  }
}
