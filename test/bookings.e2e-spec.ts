import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { Connection } from 'typeorm';
import { User } from 'src/modules/users/entities/user.entity';
import { Company } from 'src/modules/companies/entities/company.entity';
import { MealShift } from 'src/modules/stock/entities/meal-shift.entity';
import { MenuItems } from 'src/modules/stock/entities/menu-items.entity';
import { Ingredient } from 'src/modules/stock/entities/ingredient.entity';
import { Observation } from 'src/modules/users/entities/observation.entity';
import {
  Booking,
  BookingStatus,
} from 'src/modules/bookings/entities/booking.entity';

describe('BookingsController (e2e)', () => {
  let app: INestApplication;
  let connection: Connection;
  let adminToken: string; // Token for a super admin or tenant admin
  let userToken: string; // Token for a regular user
  let company: Company;
  let user: User;
  let mealShift: MealShift;
  let menuItem: MenuItems;
  let ingredient: Ingredient;
  let allergicObservation: Observation;
  let nonAllergicObservation: Observation;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    connection = app.get(Connection);

    // Clear database tables to ensure a clean state for each test run
    await connection.synchronize(true); // CAUTION: This will drop and recreate tables

    // --- Setup common test data ---
    // 1. Create Company
    company = await connection.manager.save(Company, {
      name: 'Test Company',
      isActive: true,
    });

    // 2. Create Admin and get token (assuming admin-auth module for simplicity)
    // You would typically have a way to log in an admin and get a JWT
    // For now, let's mock an admin user and directly get a token if possible,
    // or simulate an admin login. This part is highly dependent on your auth setup.
    // Let's assume a simplified token generation for e2e tests
    // For a real scenario, you'd perform a login request
    // adminToken = await getAdminToken(app);

    // 3. Create a regular User for the company
    user = await connection.manager.save(User, {
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
      password: 'password', // Hashed in real app
      companyId: company.id,
      isActive: true,
    });
    // userToken = await getUserToken(app, user.email, 'password'); // Simulate login for user

    // 4. Create Observations
    allergicObservation = await connection.manager.save(Observation, {
      name: 'Allergic to Peanuts',
      iconName: 'peanut',
      companyId: company.id,
    });
    nonAllergicObservation = await connection.manager.save(Observation, {
      name: 'Vegetarian',
      iconName: 'leaf',
      companyId: company.id,
    });

    // 5. Create Ingredient and MenuItem
    ingredient = await connection.manager.save(Ingredient, {
      name: 'Peanut',
      unit: 'UNIT',
      companyId: company.id,
      isFresh: true,
      observations: [allergicObservation], // Peanut is associated with allergic observation
    });

    menuItem = await connection.manager.save(MenuItems, {
      name: 'Peanut Butter Sandwich',
      companyId: company.id,
      type: 'PRODUCTO_SIMPLE',
      observations: [allergicObservation], // MenuItem contains peanuts
    });

    // 6. Create MealShift
    mealShift = await connection.manager.save(MealShift, {
      date: new Date(),
      shiftId: 1, // Assuming a shift exists, e.g., 'Lunch'
      menuItemId: menuItem.id,
      quantityProduced: 10,
      quantityAvailable: 5, // Only 5 available
      companyId: company.id,
    });

    // Mock tokens for simplicity in e2e testing. In a real scenario, you'd perform login requests.
    // For admin, usually a super-admin token or an admin user within the company context.
    // For user, a token obtained by logging in 'user'
    adminToken = 'Bearer mock-admin-token';
    userToken = 'Bearer mock-user-token';
  });

  afterAll(async () => {
    await connection.close();
    await app.close();
  });

  describe('POST /bookings', () => {
    it('should successfully create a booking', async () => {
      // Create a clean mealShift for this test to ensure quantityAvailable is fresh
      const freshMealShift = await connection.manager.save(MealShift, {
        date: new Date(),
        shiftId: 2,
        menuItemId: menuItem.id,
        quantityProduced: 10,
        quantityAvailable: 1, // Only 1 available for this test
        companyId: company.id,
      });

      const response = await request(app.getHttpServer())
        .post('/bookings')
        .set('Authorization', userToken) // Use user's token
        .set('x-tenant-id', company.id.toString()) // Set tenant header
        .send({ mealShiftId: freshMealShift.id })
        .expect(HttpStatus.CREATED);

      expect(response.body).toBeDefined();
      expect(response.body.status).toEqual(BookingStatus.CONFIRMED);
      expect(response.body.userId).toEqual(user.id);
      expect(response.body.mealShiftId).toEqual(freshMealShift.id);

      // Verify mealShift quantityAvailable is decremented
      const updatedMealShift = await connection.manager.findOne(
        MealShift,
        freshMealShift.id,
      );
      expect(updatedMealShift.quantityAvailable).toEqual(0);
    });

    it('should return 400 if no availability for the mealShift', async () => {
      // Create a mealShift with 0 availability
      const zeroAvailabilityMealShift = await connection.manager.save(
        MealShift,
        {
          date: new Date(),
          shiftId: 3,
          menuItemId: menuItem.id,
          quantityProduced: 5,
          quantityAvailable: 0,
          companyId: company.id,
        },
      );

      const response = await request(app.getHttpServer())
        .post('/bookings')
        .set('Authorization', userToken)
        .set('x-tenant-id', company.id.toString())
        .send({ mealShiftId: zeroAvailabilityMealShift.id })
        .expect(HttpStatus.BAD_REQUEST);

      expect(response.body.message).toContain(
        'No availability for this MealShift.',
      );
    });

    it('should return 400 if user has conflicting observations', async () => {
      // Assign the allergic observation to the user
      user.observations = [allergicObservation];
      await connection.manager.save(user);

      // Create a fresh mealShift (since previous might be consumed)
      const freshMealShift = await connection.manager.save(MealShift, {
        date: new Date(),
        shiftId: 4,
        menuItemId: menuItem.id, // This menuItem has allergicObservation
        quantityProduced: 10,
        quantityAvailable: 1,
        companyId: company.id,
      });

      const response = await request(app.getHttpServer())
        .post('/bookings')
        .set('Authorization', userToken)
        .set('x-tenant-id', company.id.toString())
        .send({ mealShiftId: freshMealShift.id })
        .expect(HttpStatus.BAD_REQUEST);

      expect(response.body.message).toContain(
        'Booking conflict: User has observations that conflict with the menu item.',
      );

      // Clean up: remove allergic observation from user for subsequent tests
      user.observations = [];
      await connection.manager.save(user);
    });

    it('should return 404 if MealShift not found', async () => {
      const response = await request(app.getHttpServer())
        .post('/bookings')
        .set('Authorization', userToken)
        .set('x-tenant-id', company.id.toString())
        .send({ mealShiftId: 99999 }) // Non-existent mealShiftId
        .expect(HttpStatus.NOT_FOUND);

      expect(response.body.message).toContain(
        'MealShift with ID 99999 not found.',
      );
    });

    it('should return 403 if tenant-id header is missing or invalid', async () => {
      const freshMealShift = await connection.manager.save(MealShift, {
        date: new Date(),
        shiftId: 5,
        menuItemId: menuItem.id,
        quantityProduced: 1,
        quantityAvailable: 1,
        companyId: company.id,
      });

      await request(app.getHttpServer())
        .post('/bookings')
        .set('Authorization', userToken)
        // Missing x-tenant-id header
        .send({ mealShiftId: freshMealShift.id })
        .expect(HttpStatus.FORBIDDEN);

      await request(app.getHttpServer())
        .post('/bookings')
        .set('Authorization', userToken)
        .set('x-tenant-id', 'invalid') // Invalid tenant-id
        .send({ mealShiftId: freshMealShift.id })
        .expect(HttpStatus.FORBIDDEN);
    });
  });

  describe('GET /bookings', () => {
    it('should return all bookings for the current tenant', async () => {
      // Create some bookings for the company
      await connection.manager.save(Booking, {
        userId: user.id,
        mealShiftId: mealShift.id,
        companyId: company.id,
        status: BookingStatus.CONFIRMED,
      });
      await connection.manager.save(Booking, {
        userId: user.id,
        mealShiftId: mealShift.id,
        companyId: company.id,
        status: BookingStatus.CONFIRMED,
      });

      const response = await request(app.getHttpServer())
        .get('/bookings')
        .set('Authorization', userToken)
        .set('x-tenant-id', company.id.toString())
        .expect(HttpStatus.OK);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBeGreaterThanOrEqual(2); // At least the two we just created
      expect(response.body[0].companyId).toEqual(company.id);
    });

    it('should return 403 if tenant-id header is missing or invalid', async () => {
      await request(app.getHttpServer())
        .get('/bookings')
        .set('Authorization', userToken)
        // Missing x-tenant-id header
        .expect(HttpStatus.FORBIDDEN);

      await request(app.getHttpServer())
        .get('/bookings')
        .set('Authorization', userToken)
        .set('x-tenant-id', 'invalid') // Invalid tenant-id
        .expect(HttpStatus.FORBIDDEN);
    });
  });
});
