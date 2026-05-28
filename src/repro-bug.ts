
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { IngredientService } from './modules/stock/services/ingredient.service';
import { UpdateIngredientDto } from './modules/stock/dto/update-ingredient.dto';

async function reproduce() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const ingredientService = app.get(IngredientService);

  const companyId = 1; // Assuming company 1 exists
  const userId = 1;

  // Find an existing ingredient to update
  const ingredients = await ingredientService.findAllForTenant(companyId);
  if (ingredients.length === 0) {
    console.log('No ingredients found for company 1. Please create one first.');
    await app.close();
    return;
  }

  const target = ingredients[0];
  console.log(`Attempting to update ingredient ${target.id} with shrinkagePercentage: null`);

  const updateDto: UpdateIngredientDto = {
    shrinkagePercentage: null as any,
    defaultSupplierId: 1,
    categoryId: null
  };

  try {
    await ingredientService.update(target.id, updateDto, companyId, userId);
    console.log('Update successful (unexpected)');
  } catch (error) {
    console.error('Update failed as expected:');
    console.error(error.message);
    if (error.driverError) {
        console.error('Driver Error:', error.driverError.message);
    }
  }

  await app.close();
}

reproduce();
