# Backend Modules Documentation

This document provides an overview of the backend modules, their responsibilities, and key functionalities, including technical details.

---

### `admin_auth`

-   **Description**: Manages authentication and authorization for backoffice administrators, providing a separate login system from main application users.
-   **Key Functionalities**:
    -   `AdminAuthController`: Exposes `@Public()` endpoints for `/register` and `/login`. The `/profile` endpoint is protected.
    -   `AdminAuthService`: Implements `register`, `validateUser` (compares password hash with `bcrypt`), and `login` (generates JWT).
-   **Entities**:
    -   `AdminUser`: Stores `username`, `passwordHash`, and `role` (enum `AdminRole`). Not tenant-specific.
-   **Security**:
    -   `AdminJwtStrategy`: Custom Passport strategy that validates the JWT and ensures the payload contains an `isAdmin: true` flag.
    -   `RolesGuard`: Protects routes based on `AdminRole` enums defined in the `@Roles()` decorator.

---

### `auth`

-   **Description**: Handles authentication for regular, tenant-specific users (diners, kitchen staff, company admins) and manages the initial registration of new companies.
-   **Key Functionalities**:
    -   `AuthController`: Manages `/register-company`, `/login`, and role-specific user registration (`/register-diner`, etc.). Uses the `@CurrentUser` decorator to inject the authenticated user.
    -   `AuthService`:
        -   `registerCompany`: A transactional method that creates a `Company` and its initial `User` with the `COMPANY_ADMIN` role.
        -   `login`: Validates credentials and returns a JWT containing `userId`, `username`, `role`, and `companyId`.
        -   `verifyRegistration`: Validates an email verification code.
-   **Security**:
    -   `JwtAuthGuard`: Global guard that allows public access if an endpoint is decorated with `@Public()`.
    -   `JwtStrategy`: Passport strategy that validates the token and attaches the full `User` object (including relations like `company`) to the request.

---

### `companies`

-   **Description**: Manages company profiles and settings.
-   **Key Functionalities**:
    -   `CompaniesController`: Endpoints are guarded, but authorization logic is handled within service methods, checking if the user is a `super_admin` or a `company_admin` operating on their own company.
    -   `CompaniesService`: Implements standard CRUD operations. Uses a private `ensureUnique` method with a TypeORM `QueryBuilder` to prevent duplicate company `name` or `taxId` on create and update.
-   **Entities**:
    -   `Company`: Has a `OneToMany` relationship with `User`. Stores company details and status (`active`/`inactive`).

---

### `costing`

-   **Description**: A specialized module for calculating the production cost of menu items based on their recipes and the current cost of ingredients.
-   **Key Functionalities**:
    -   `CostingService`:
        -   `calculateMenuItemCost`: The core method. It fetches a `MenuItems` with its `recipeIngredients`. For each ingredient, it calls `getFifoCostForIngredient` to determine the cost.
        -   `getFifoCostForIngredient`: Implements FIFO costing by fetching all `IngredientLot`s with `quantity > 0`, ordering them by `expirationDate` ASC, and consuming the required quantity from the oldest lots first.
        -   **Shrinkage Calculation**: It accounts for the `shrinkagePercentage` on the `Ingredient` entity to calculate the gross amount of ingredient needed.
-   **Integration**: Used by `MenuItemController` (`/theoretical-cost` endpoint) and `MealShiftService` (to determine the cost of a produced item).

---

### `mail`

-   **Description**: Handles all outbound transactional emails.
-   **Key Functionalities**:
    -   `MailService`:
        -   Uses the `@getbrevo/brevo` SDK to send emails.
        -   A private `compileTemplate` method reads `.hbs` files from the filesystem, compiles them with Handlebars, and injects the dynamic context.
        -   `sendUserCredentials`: Sends login details to a new user.
        -   `sendVerificationCode`: Sends a time-sensitive verification code.
-   **Configuration**:
    -   `MailModule`: Uses `MailerModule.forRootAsync` to load SMTP credentials and settings from `ConfigService` at runtime.

---

### `payments`

-   **Description**: This module is a placeholder for future payment processing functionality. It currently contains no logic or entities.

---

### `purchases`

-   **Description**: Manages the procurement process, from creating purchase orders to receiving goods and updating stock.
-   **Key Functionalities**:
    -   `PurchasesController`: Protected by `Roles('company_admin', 'kitchen_admin')`. Uses the `@Tenant()` decorator to ensure all operations are scoped to the user's company.
    -   `PurchasesService`:
        -   `create`: A transactional method that validates the supplier and all items before creating a `PurchaseOrder`.
        -   `receive`: The critical method that finalizes a purchase. It iterates through all `PurchaseOrderItem`s and calls `stockService.registerMovement` with `MovementType.IN` for each one, effectively adding the received goods to the inventory as new lots.
-   **Entities**:
    -   `PurchaseOrder`: The header of the order, linked to a `Supplier`.
    -   `PurchaseOrderItem`: A line item in the order. A `CHECK` constraint ensures it's linked to either an `ingredientId` or a `menuItemId`, but not both.

---

### `reports`

-   **Description**: A read-only module for generating complex data aggregations and reports for business intelligence.
-   **Key Functionalities**:
    -   `ReportsController`: Exposes multiple `GET` endpoints, each corresponding to a specific report. All are protected and use the `@Tenant()` decorator.
    -   `ReportsService`: Contains highly optimized `QueryBuilder` queries to generate reports efficiently.
        -   `getMostConsumedItems`: Uses `SUM` and `GROUP BY` on `ticket.items` to find top-selling products.
        -   `getConsumptionTrend`: Groups ticket data by `CAST(createdAt AS DATE)` to show daily consumption patterns.
        -   `getInventoryVarianceReport`: Fetches `StockAudit` records and calculates the monetary impact of inventory differences.
        -   `getGeneralReport`: A master method that calls all other report-generating methods in parallel using `Promise.all` to compile a complete data set for export.

---

### `shift`

-   **Description**: Manages work shifts and the specific menus available during those times.
-   **Key Functionalities**:
    -   `ShiftController`:
        -   `GET /active-by-hour/:tenantId`: A crucial public endpoint that allows clients to fetch the currently active menu based on the time in a specific timezone (`America/Argentina/Buenos_Aires`).
    -   `ShiftService`:
        -   `create`/`update`: Transactional methods. When adding `MenuItem`s to a shift, they validate that the items belong to the tenant. For composite products, they call `mealShiftService.isMenuItemProducedForShift` to ensure the item has been marked as "produced" for that day and shift before being made available.
-   **Entities**:
    -   `Shift`: Defines a time window (`startTime`, `endTime`) and has a `ManyToMany` relationship with `MenuItems` to define a menu.

---

### `stock`

-   **Description**: The core inventory management module. It is built on a lot-based system for full traceability.
-   **Key Functionalities & Services**:
    -   `StockService`: The central service.
        -   `registerMovement`: The main entry point for all inventory changes. It's a transactional method that delegates to `handleInMovement` or `handleOutMovement`.
        -   `handleInMovement`: Creates or updates an `IngredientLot` or `MenuItemLot` with a new quantity and cost.
        -   `handleOutMovement`: Decrements the quantity from a *specific* lot (`ingredientLotId` or `menuItemLotId`), ensuring there is sufficient stock in that lot.
        -   `handleAudit`: A complex transactional method that compares physical vs. theoretical stock, and automatically generates `ADJUSTMENT` movements (using FIFO for shortages) to align the system inventory with reality.
    -   `MealShiftService`:
        -   `create`: Orchestrates the production process. It's a transaction that:
            1.  Calculates the cost of the `MenuItems` via `CostingService`.
            2.  Creates an `IN` movement for the produced `MenuItems`, creating a new `MenuItemLot`.
            3.  Creates `OUT` movements for all consumed `Ingredients` based on the recipe, accounting for `shrinkagePercentage`.
    -   `IngredientService` / `MenuItemService`: Handle CRUD for their respective entities. Stock is not managed directly in these services anymore; all inventory changes must go through `StockService`.
-   **Entities**:
    -   The system revolves around `IngredientLot` and `MenuItemLot`, which hold the actual stock quantities and costs. `Ingredient` and `MenuItems` act as master data.
    -   `StockMovement`: An immutable log of every inventory transaction, linked to the user, the item/ingredient, the specific lot, and optionally a `Ticket` or `StockAudit`.
    -   `RecipeIngredient`: A join table defining the components of a composite `MenuItems`.

---

### `subscription`

-   **Description**: This module is a placeholder for future subscription and billing management. It currently contains no logic or entities.

---

### `suppliers`

-   **Description**: Manages supplier information.
-   **Key Functionalities**:
    -   `SuppliersController`: Provides standard tenant-aware CRUD endpoints for suppliers, accessible to `company_admin` and `kitchen_admin`.
    -   `SuppliersService`: Implements basic CRUD operations, ensuring all actions are scoped to the `companyId` of the authenticated user.
-   **Entities**:
    -   `Supplier`: A tenant-specific entity (`extends BaseTenantEntity`) that stores supplier contact details. It has a `OneToMany` relationship with `PurchaseOrder`.

---

### `tasks`

-   **Description**: A module for running background jobs and scheduled tasks.
-   **Key Functionalities**:
    -   `TasksService`:
        -   `handleDailyMenuCleanup`: A method decorated with `@Cron(CronExpression.EVERY_DAY_AT_1AM)`. It fetches all `Shift`s, filters their `menuItems` relationship to remove any products of type `PRODUCTO_COMPUESTO`, and saves the changes. This effectively resets the daily production menus.
-   **Integration**: Uses the `@nestjs/schedule` package.

---

### `tickets`

-   **Description**: Manages the entire lifecycle of meal tickets, from creation and validation to consumption and stock deduction.
-   **Key Functionalities**:
    -   `TicketService`:
        -   `create`: Validates a user's PIN against all users within the tenant.
        -   `createManual`: Allows an admin to create a pre-used ticket for a user, immediately deducting stock.
        -   `markAsUsed`: The most critical method. It changes the ticket status and calls the private `deductStockForTicket` method.
        -   `deductStockForTicket`: Iterates through ticket items, calculates the required ingredients from recipes, and calls `stockService.registerMovement` (`OUT`) for each item/ingredient to be consumed from inventory. After deduction, it calls `checkAndNotifyLowStock`.
    -   `TicketGateway`:
        -   Uses `socket.io` to manage real-time communication.
        -   On connection, clients join a room based on their `companyId` (`company_{companyId}`).
        -   Broadcasts events like `newTicket`, `ticketUpdated`, and `lowStockAlert` to the appropriate company's room.
-   **Entities**:
    -   `Ticket`: Linked to a `User` and `Shift`. Its status is managed by the `TicketStatus` enum.
    -   `TicketItem`: A join entity that stores the `MenuItems` on a ticket and its `quantity`, allowing multiple of the same item on one ticket.

---

### `users`

-   **Description**: Manages user profiles, roles, and personal data like dietary observations.
-   **Key Functionalities**:
    -   `UsersService`:
        -   Uses `bcrypt` for hashing and comparing passwords and PINs.
        -   `generateUniqueUsername`: Creates a unique username within a company context (e.g., `john2@companyname`).
        -   Uses `TenantAwareRepository` helper methods (`findOneByTenant`, `createTenantQueryBuilder`) to simplify multi-tenant database queries.
    -   `UsersController`: Employs role-based checks to determine the query scope. A `super_admin` can see all users, while a `company_admin` can only see users where `user.companyId` matches their own.
-   **Entities**:
    -   `User`: Extends `BaseTenantEntity` and is the central entity for application users.
    -   `Observation`: Stores dietary restrictions/allergies and has a `ManyToMany` relationship with `User`.

---

### `users_backoffice`

-   **Description**: A secure module for `super_admin` users to perform cross-tenant user management.
-   **Key Functionalities**:
    -   `BackofficeUsersService`: Implements CRUD operations for `User` entities without a strict `companyId` filter, allowing super admins to manage any user in the system and assign them to any company.
    -   `BackofficeUsersController`: The entire controller is protected by `AdminJwtAuthGuard` and `@Roles(AdminRole.SUPER_ADMIN)`, ensuring only authenticated super administrators from the backoffice can access these powerful endpoints.
-   **Security**: This module is a prime example of layered security, combining a dedicated authentication strategy with strict role guards.

---

### `waste`

-   **Description**: Manages the logging and inventory adjustment for food waste, with traceability to the specific lot.
-   **Key Functionalities**:
    -   `WasteService`:
        -   `createWasteLog`: The core method. It validates that the specified `IngredientLot` or `MenuItemLot` exists and belongs to the tenant. It then immediately calls `stockService.registerMovement` with `MovementType.OUT` to deduct the wasted quantity from that *exact lot*. Finally, it creates the `WasteLog` record.
-   **Entities**:
    -   `WasteLog`: A tenant-specific record linked directly to either an `IngredientLot` or a `MenuItemLot`, providing precise traceability for wasted items.
-   **DTOs**:
    -   `CreateWasteLogDto`: Uses a custom validator (`IsOnlyOnePresentConstraint`) to enforce that a waste log is created for either an ingredient lot or a menu item lot, but not both simultaneously.
