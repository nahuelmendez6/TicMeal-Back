# Resumen de Implementación de Gestión de Demanda y Producción

Este documento resume las funcionalidades, modelos y endpoints implementados y modificados para soportar los módulos de Pre-reserva (Gestión de Demanda) y Producción (Gestión de Ejecución) en el sistema Ticmeal.

## Entidades Extendidas y Modificadas

Se realizaron modificaciones en las siguientes entidades existentes para integrar las nuevas funcionalidades:

1.  **`src/modules/users/entities/observation.entity.ts`**
    *   **Extensión**: Ahora extiende `BaseTenantEntity` para asegurar el aislamiento multitenant de las observaciones.
    *   **Nuevas Relaciones**: Se añadieron relaciones `ManyToMany` con `Ingredient` y `MenuItems` para vincular observaciones a alérgenos o restricciones dietéticas específicas.

2.  **`src/modules/stock/entities/ingredient.entity.ts`**
    *   **Nueva Columna**: Se añadió `isFresh: boolean` para identificar ingredientes que requieren lógica Just-in-Time (JIT) en la producción.
    *   **Nueva Relación**: Se añadió una relación `ManyToMany` inversa con `Observation`.

3.  **`src/modules/stock/entities/menu-items.entity.ts`**
    *   **Nueva Relación**: Se añadió una relación `ManyToMany` inversa con `Observation`.

4.  **`src/modules/purchases/entities/purchase-order.entity.ts`** y **`src/modules/purchases/entities/purchase-order-item.entity.ts`**
    *   Se adaptó la lógica de JIT para utilizar estas entidades preexistentes para la creación de borradores de órdenes de compra.

## Nuevas Entidades Implementadas

Se crearon nuevas entidades para dar soporte a la funcionalidad de pre-reserva y gestión de picking:

1.  **`src/modules/bookings/entities/booking.entity.ts`**
    *   **Descripción**: Representa la pre-reserva de un usuario para una comida específica en un turno de comida (`MealShift`).
    *   **Campos Clave**: `status` (PENDING, CONFIRMED, CANCELLED, WAITLISTED), `userId` (relación ManyToOne con `User`), `mealShiftId` (relación ManyToOne con `MealShift`), `companyId`.
    *   **Extensión**: Extiende `BaseTenantEntity`.

2.  **`src/modules/production/entities/picking-list.entity.ts`**
    *   **Descripción**: Representa una lista de ingredientes que deben ser recolectados del almacén para la producción de un día específico.
    *   **Campos Clave**: `date`, `status` (PENDING, IN_PROGRESS, COMPLETED, CANCELLED), `companyId`.
    *   **Extensión**: Extiende `BaseTenantEntity`.
    *   **Relación**: `OneToMany` con `PickingListItem`.

3.  **`src/modules/production/entities/picking-list-item.entity.ts`**
    *   **Descripción**: Representa un ítem dentro de una `PickingList`, detallando un ingrediente y la cantidad requerida.
    *   **Campos Clave**: `pickingListId` (ManyToOne con `PickingList`), `ingredientId` (ManyToOne con `Ingredient`), `requiredQuantity`, `pickedQuantity`.

## Módulos y Servicios Actualizados/Creados

### 1. Módulo `Bookings` (`src/modules/bookings`)

*   **`BookingsService`**:
    *   **`createBooking(dto: CreateBookingDto, userId: number, companyId: number)`**:
        *   Permite a un usuario crear una pre-reserva.
        *   **Validaciones**: Verifica la disponibilidad (`MealShift.quantityAvailable`), y valida el perfil de salud del usuario (observaciones) contra los alérgenos/observaciones del plato (`MenuItem`).
        *   **Impacto**: Decrementa `MealShift.quantityAvailable`.
    *   **`findAllBookings(companyId: number)`**:
        *   Recupera todas las pre-reservas para una compañía específica, incluyendo relaciones (`User`, `MealShift`, `MenuItem`).
*   **`BookingsController`**:
    *   **Protección**: Protegido con `JwtAuthGuard`, `TenantGuard`.
    *   **Endpoints**:
        *   `POST /bookings`: `create` (Crear una nueva pre-reserva).
        *   `GET /bookings`: `findAll` (Recuperar todas las pre-reservas).
    *   **Documentación Swagger**: `@ApiTags`, `@ApiOperation`, `@ApiResponse`, `@ApiBearerAuth` añadidos.
*   **`CreateBookingDto`**: DTO para la creación de pre-reservas, con `@ApiProperty` y `class-validator`.

### 2. Módulo `Production` (`src/modules/production`)

*   **`ProductionService`**:
    *   **`handleProductionPlan()`**:
        *   **Tipo**: Método `CronJob` (`@Cron(CronExpression.EVERY_DAY_AT_2AM)`) que se ejecuta diariamente.
        *   **Funcionalidad**: Consolida las pre-reservas confirmadas para el día siguiente, actualiza `MealShift.quantityProduced` (lo que a su vez ajusta `quantityAvailable`), y dispara el proceso de `_processProductionForCompany`.
    *   **`_processProductionForCompany(companyId: number, targetDate: string)`**:
        *   **Funcionalidad**:
            *   **Explosión de Escandallos (BOM Explosion)**: Calcula la cantidad total de cada ingrediente necesaria para todas las `MealShift` con producción para la `targetDate`.
            *   **Lógica Just-in-Time (JIT)**: Identifica ingredientes frescos (`isFresh`) donde la demanda excede el stock actual, generando un borrador de `PurchaseOrder` con `PurchaseOrderItem`s asociados.
            *   **Generación de `PickingList`**: Crea una lista de recolección (`PickingList`) detallando los ingredientes y cantidades necesarias para el personal de almacén.
    *   **`getPickingListByDate(companyId: number, date: string)`**:
        *   Recupera una `PickingList` específica para una fecha y compañía.
    *   **`handleProductionPlanManual(companyId: number, date: string)`**:
        *   Permite a un administrador disparar manualmente el proceso de planificación de producción para una fecha específica.
*   **`ProductionController`**:
    *   **Protección**: Protegido con `JwtAuthGuard`, `TenantGuard`.
    *   **Endpoints**:
        *   `GET /production/picking-lists/:date`: `getPickingList` (Recuperar una `PickingList`).
        *   `POST /production/trigger-plan-manual/:date`: `triggerProductionPlanManual` (Disparo manual del plan de producción).
    *   **Documentación Swagger**: `@ApiTags`, `@ApiOperation`, `@ApiResponse`, `@ApiBearerAuth` añadidos.

### 3. Configuración de `NestJS Schedule`

*   **`src/app.module.ts`**: Se añadió `ScheduleModule.forRoot()` al array `imports` para habilitar el módulo de tareas programadas (`CronJobs`).

## Herramientas y Patrones Clave Utilizados

*   **Arquitectura Multitenant**: Todas las operaciones y nuevas entidades respetan la arquitectura multitenant, utilizando `BaseTenantEntity` y los métodos estáticos de `TenantAwareRepository` (`findOneByTenant`, `findAllByTenant`, `createTenantQueryBuilder`) para asegurar el aislamiento de datos por `companyId`.
*   **TypeORM**: Utilizado para la definición de entidades y la interacción con la base de datos, incluyendo relaciones `ManyToOne`, `OneToMany`, `ManyToMany` y `cascade`.
*   **`class-validator`**: Empleado en DTOs para la validación de entrada.
*   **Swagger (OpenAPI)**: Documentación automática de la API RESTful para los nuevos módulos y endpoints, mejorando la discoverability y usabilidad.
*   **`@nestjs/schedule`**: Implementación de tareas programadas (`CronJobs`) para automatizar el proceso de planificación de producción.

## Pruebas End-to-End (E2E)

Se creó el archivo `test/bookings.e2e-spec.ts` para cubrir los siguientes escenarios del flujo de reservas:

*   Creación exitosa de una reserva.
*   Fallo en la reserva por falta de disponibilidad en el `MealShift`.
*   Fallo en la reserva debido a conflictos de observaciones (alérgenos/restricciones) entre el usuario y el `MenuItem`.
*   Fallo en la reserva si el `MealShift` no existe.
*   Pruebas de acceso (headers `x-tenant-id` y autenticación JWT).
*   Recuperación de todas las reservas para un inquilino específico.

Este resumen proporciona una visión general de los cambios implementados, destacando cómo se abordaron los requisitos del usuario y se integraron con la base de código existente.
