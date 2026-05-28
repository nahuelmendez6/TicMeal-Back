"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const common_1 = require("@nestjs/common");
const supertest_1 = require("supertest");
const app_module_1 = require("../src/app.module");
const typeorm_1 = require("typeorm");
const user_entity_1 = require("src/modules/users/entities/user.entity");
const company_entity_1 = require("src/modules/companies/entities/company.entity");
const meal_shift_entity_1 = require("src/modules/stock/entities/meal-shift.entity");
const menu_items_entity_1 = require("src/modules/stock/entities/menu-items.entity");
const ingredient_entity_1 = require("src/modules/stock/entities/ingredient.entity");
const observation_entity_1 = require("src/modules/users/entities/observation.entity");
const booking_entity_1 = require("src/modules/bookings/entities/booking.entity");
describe('BookingsController (e2e)', () => {
    let app;
    let connection;
    let adminToken;
    let userToken;
    let company;
    let user;
    let mealShift;
    let menuItem;
    let ingredient;
    let allergicObservation;
    let nonAllergicObservation;
    beforeAll(async () => {
        const moduleFixture = await testing_1.Test.createTestingModule({
            imports: [app_module_1.AppModule],
        }).compile();
        app = moduleFixture.createNestApplication();
        await app.init();
        connection = app.get(typeorm_1.Connection);
        await connection.synchronize(true);
        company = await connection.manager.save(company_entity_1.Company, {
            name: 'Test Company',
            isActive: true,
        });
        user = await connection.manager.save(user_entity_1.User, {
            firstName: 'Test',
            lastName: 'User',
            email: 'test@example.com',
            password: 'password',
            companyId: company.id,
            isActive: true,
        });
        allergicObservation = await connection.manager.save(observation_entity_1.Observation, {
            name: 'Allergic to Peanuts',
            iconName: 'peanut',
        });
        nonAllergicObservation = await connection.manager.save(observation_entity_1.Observation, {
            name: 'Vegetarian',
            iconName: 'leaf',
        });
        ingredient = await connection.manager.save(ingredient_entity_1.Ingredient, {
            name: 'Peanut',
            unit: 'UNIT',
            companyId: company.id,
            isFresh: true,
            observations: [allergicObservation],
        });
        menuItem = await connection.manager.save(menu_items_entity_1.MenuItems, {
            name: 'Peanut Butter Sandwich',
            companyId: company.id,
            type: 'PRODUCTO_SIMPLE',
            observations: [allergicObservation],
        });
        mealShift = await connection.manager.save(meal_shift_entity_1.MealShift, {
            date: new Date(),
            shiftId: 1,
            menuItemId: menuItem.id,
            quantityProduced: 10,
            quantityAvailable: 5,
            companyId: company.id,
        });
        adminToken = 'Bearer mock-admin-token';
        userToken = 'Bearer mock-user-token';
    });
    afterAll(async () => {
        await connection.close();
        await app.close();
    });
    describe('POST /bookings', () => {
        it('should successfully create a booking', async () => {
            const freshMealShift = await connection.manager.save(meal_shift_entity_1.MealShift, {
                date: new Date(),
                shiftId: 2,
                menuItemId: menuItem.id,
                quantityProduced: 10,
                quantityAvailable: 1,
                companyId: company.id,
            });
            const response = await (0, supertest_1.default)(app.getHttpServer())
                .post('/bookings')
                .set('Authorization', userToken)
                .set('x-tenant-id', company.id.toString())
                .send({ mealShiftId: freshMealShift.id })
                .expect(common_1.HttpStatus.CREATED);
            expect(response.body).toBeDefined();
            expect(response.body.status).toEqual(booking_entity_1.BookingStatus.CONFIRMED);
            expect(response.body.userId).toEqual(user.id);
            expect(response.body.mealShiftId).toEqual(freshMealShift.id);
            const updatedMealShift = await connection.manager.findOne(meal_shift_entity_1.MealShift, freshMealShift.id);
            expect(updatedMealShift.quantityAvailable).toEqual(0);
        });
        it('should return 400 if no availability for the mealShift', async () => {
            const zeroAvailabilityMealShift = await connection.manager.save(meal_shift_entity_1.MealShift, {
                date: new Date(),
                shiftId: 3,
                menuItemId: menuItem.id,
                quantityProduced: 5,
                quantityAvailable: 0,
                companyId: company.id,
            });
            const response = await (0, supertest_1.default)(app.getHttpServer())
                .post('/bookings')
                .set('Authorization', userToken)
                .set('x-tenant-id', company.id.toString())
                .send({ mealShiftId: zeroAvailabilityMealShift.id })
                .expect(common_1.HttpStatus.BAD_REQUEST);
            expect(response.body.message).toContain('No availability for this MealShift.');
        });
        it('should return 400 if user has conflicting observations', async () => {
            user.observations = [allergicObservation];
            await connection.manager.save(user);
            const freshMealShift = await connection.manager.save(meal_shift_entity_1.MealShift, {
                date: new Date(),
                shiftId: 4,
                menuItemId: menuItem.id,
                quantityProduced: 10,
                quantityAvailable: 1,
                companyId: company.id,
            });
            const response = await (0, supertest_1.default)(app.getHttpServer())
                .post('/bookings')
                .set('Authorization', userToken)
                .set('x-tenant-id', company.id.toString())
                .send({ mealShiftId: freshMealShift.id })
                .expect(common_1.HttpStatus.BAD_REQUEST);
            expect(response.body.message).toContain('Booking conflict: User has observations that conflict with the menu item.');
            user.observations = [];
            await connection.manager.save(user);
        });
        it('should return 404 if MealShift not found', async () => {
            const response = await (0, supertest_1.default)(app.getHttpServer())
                .post('/bookings')
                .set('Authorization', userToken)
                .set('x-tenant-id', company.id.toString())
                .send({ mealShiftId: 99999 })
                .expect(common_1.HttpStatus.NOT_FOUND);
            expect(response.body.message).toContain('MealShift with ID 99999 not found.');
        });
        it('should return 403 if tenant-id header is missing or invalid', async () => {
            const freshMealShift = await connection.manager.save(meal_shift_entity_1.MealShift, {
                date: new Date(),
                shiftId: 5,
                menuItemId: menuItem.id,
                quantityProduced: 1,
                quantityAvailable: 1,
                companyId: company.id,
            });
            await (0, supertest_1.default)(app.getHttpServer())
                .post('/bookings')
                .set('Authorization', userToken)
                .send({ mealShiftId: freshMealShift.id })
                .expect(common_1.HttpStatus.FORBIDDEN);
            await (0, supertest_1.default)(app.getHttpServer())
                .post('/bookings')
                .set('Authorization', userToken)
                .set('x-tenant-id', 'invalid')
                .send({ mealShiftId: freshMealShift.id })
                .expect(common_1.HttpStatus.FORBIDDEN);
        });
    });
    describe('GET /bookings', () => {
        it('should return all bookings for the current tenant', async () => {
            await connection.manager.save(booking_entity_1.Booking, {
                userId: user.id,
                mealShiftId: mealShift.id,
                companyId: company.id,
                status: booking_entity_1.BookingStatus.CONFIRMED,
            });
            await connection.manager.save(booking_entity_1.Booking, {
                userId: user.id,
                mealShiftId: mealShift.id,
                companyId: company.id,
                status: booking_entity_1.BookingStatus.CONFIRMED,
            });
            const response = await (0, supertest_1.default)(app.getHttpServer())
                .get('/bookings')
                .set('Authorization', userToken)
                .set('x-tenant-id', company.id.toString())
                .expect(common_1.HttpStatus.OK);
            expect(response.body).toBeInstanceOf(Array);
            expect(response.body.length).toBeGreaterThanOrEqual(2);
            expect(response.body[0].companyId).toEqual(company.id);
        });
        it('should return 403 if tenant-id header is missing or invalid', async () => {
            await (0, supertest_1.default)(app.getHttpServer())
                .get('/bookings')
                .set('Authorization', userToken)
                .expect(common_1.HttpStatus.FORBIDDEN);
            await (0, supertest_1.default)(app.getHttpServer())
                .get('/bookings')
                .set('Authorization', userToken)
                .set('x-tenant-id', 'invalid')
                .expect(common_1.HttpStatus.FORBIDDEN);
        });
    });
});
//# sourceMappingURL=bookings.e2e-spec.js.map