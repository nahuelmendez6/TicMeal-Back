import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
import { User } from './src/modules/users/entities/user.entity';
import { Company } from './src/modules/companies/entities/company.entity';
import { Observation } from './src/modules/users/entities/observation.entity';
import { Ticket } from './src/modules/tickets/entities/ticket.entity';

dotenv.config();

async function emergencyReset() {
  const AppDataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASS || 'nM1258menMa',
    database: process.env.DB_NAME || 'postgres',
    entities: [User, Company, Observation, Ticket],
    synchronize: false,
  });

  try {
    await AppDataSource.initialize();
    console.log('Conectado a la DB.');

    const userId = 31;
    const newPassword = '252423';
    
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(newPassword, salt);

    console.log(`Reseteando password para ID ${userId}...`);
    console.log(`Nuevo hash: ${hash}`);

    const result = await AppDataSource.createQueryBuilder()
      .update(User)
      .set({ password: hash })
      .where("id = :id", { id: userId })
      .execute();

    if (result.affected) {
      console.log('✅ Password actualizado con éxito en la base de datos.');
    } else {
      console.log('❌ No se encontró el usuario con ID 31.');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await AppDataSource.destroy();
  }
}

emergencyReset();
