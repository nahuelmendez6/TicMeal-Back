import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { UsersService } from './src/modules/users/services/user.service';
import { User } from './src/modules/users/entities/user.entity';
import { DataSource } from 'typeorm';

async function resetPassword() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const userService = app.get(UsersService);
  const dataSource = app.get(DataSource);
  const userRepo = dataSource.getRepository(User);

  const userId = 31;
  const newPlainPassword = '252423';

  console.log(`Buscando usuario ID: ${userId}...`);
  const user = await userRepo.findOne({ where: { id: userId } });

  if (!user) {
    console.log('Usuario no encontrado.');
    await app.close();
    return;
  }

  console.log(`Reseteando password para ${user.username} a "${newPlainPassword}"...`);
  
  // Usamos el método de update que ya tiene la lógica de hasheo
  await userService.updateUser(userId, { password: newPlainPassword } as any);

  console.log('✅ Password actualizado correctamente.');
  await app.close();
}

resetPassword().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
