import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { StockMovement } from '../../stock/entities/stock-movement.entity';
import { GetStockMovementsReportDto } from '../dto/get-stock-movements-report.dto';
import { Ticket, TicketStatus } from '../../tickets/entities/ticket.entity';
import { Ingredient } from '../../stock/entities/ingredient.entity';
import { MenuItems } from '../../stock/entities/menu-items.entity';
import { MovementType } from '../../stock/enums/enums';
import { StockAudit } from 'src/modules/stock/entities/stock-audit.entity';
import { DateRangeDto } from '../dto/date-range.dto';
import { StockAuditType } from 'src/modules/stock/enums/stock-audit-type.enum';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(StockMovement)
    private readonly stockMovementRepository: Repository<StockMovement>,
    @InjectRepository(Ticket)
    private readonly ticketRepository: Repository<Ticket>,
    @InjectRepository(Ingredient)
    private readonly ingredientRepository: Repository<Ingredient>,
    @InjectRepository(MenuItems)
    private readonly menuItemRepository: Repository<MenuItems>,
    @InjectRepository(StockAudit)
    private readonly stockAuditRepository: Repository<StockAudit>,
  ) {}

  async getInventoryVarianceReport(
    dto: DateRangeDto,
    tenantId: number,
  ): Promise<any> {
    const { startDate, endDate } = dto;

    const audits = await this.stockAuditRepository
      .createQueryBuilder('audit')
      .leftJoinAndSelect('audit.ingredient', 'ingredient')
      .leftJoinAndSelect('audit.menuItem', 'menuItem')
      .where('audit.companyId = :tenantId', { tenantId })
      .andWhere('audit.auditDate BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .orderBy('audit.auditDate', 'ASC')
      .getMany();

    let totalVariance = 0;
    let totalPositiveVariance = 0; // Surplus
    let totalNegativeVariance = 0; // Shortage
    const totalAudits = audits.length;

    const detailedAudits = audits.map((audit) => {
      const monetaryDifference = audit.difference * audit.unitCostAtAudit;
      totalVariance += monetaryDifference;

      if (monetaryDifference > 0) {
        totalPositiveVariance += monetaryDifference;
      } else {
        totalNegativeVariance += monetaryDifference;
      }

      return {
        id: audit.id,
        auditDate: audit.auditDate,
        auditType: audit.auditType,
        itemName:
          audit.auditType === StockAuditType.INGREDIENT
            ? audit.ingredient?.name
            : audit.menuItem?.name,
        itemId:
          audit.auditType === StockAuditType.INGREDIENT
            ? audit.ingredientId
            : audit.menuItemId,
        theoreticalStock: audit.theoreticalStock,
        physicalStock: audit.physicalStock,
        differenceQuantity: audit.difference,
        unitCostAtAudit: audit.unitCostAtAudit,
        monetaryDifference: monetaryDifference,
        observations: audit.observations,
      };
    });

    return {
      summary: {
        totalAudits,
        totalVariance: parseFloat(totalVariance.toFixed(2)),
        totalPositiveVariance: parseFloat(totalPositiveVariance.toFixed(2)),
        totalNegativeVariance: parseFloat(totalNegativeVariance.toFixed(2)),
        period: { startDate, endDate },
      },
      details: detailedAudits,
    };
  }

  async getStockMovementsReport(
    dto: GetStockMovementsReportDto,
    tenantId: number,
  ) {
    const { startDate: startDateStr, endDate: endDateStr, movementType } = dto;

    // Para evitar problemas de zona horaria, es más robusto trabajar con objetos Date.
    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);
    endDate.setUTCHours(23, 59, 59, 999);

    const query = this.stockMovementRepository
      .createQueryBuilder('movement')
      .leftJoinAndSelect('movement.menuItem', 'menuItem')
      .leftJoinAndSelect('movement.ingredient', 'ingredient')
      .leftJoinAndSelect('movement.performedBy', 'user')
      .where('movement.companyId = :tenantId', { tenantId })
      .andWhere('movement.createdAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .andWhere(
        '(menuItem.isActive = :isActive OR ingredient.isActive = :isActive)',
        { isActive: true },
      );

    if (movementType) {
      query.andWhere('movement.movementType = :movementType', { movementType });
    }

    query.orderBy('movement.createdAt', 'DESC');

    return await query.getMany();
  }

  /**
   * Genera un reporte de los ítems de menú más consumidos en un período, basado en tickets.
   * @param dto - DTO con rango de fechas y límite opcional.
   * @param tenantId - ID del tenant.
   * @returns Un arreglo de objetos con el nombre del ítem y el total consumido.
   */
  async getMostConsumedItems(
    dto: GetStockMovementsReportDto,
    tenantId: number,
  ) {
    const { startDate: startDateStr, endDate: endDateStr, limit = 10 } = dto;

    // Para evitar problemas de zona horaria, es más robusto trabajar con objetos Date.
    // new Date('YYYY-MM-DD') crea una fecha a la medianoche en UTC.
    const startDate = new Date(startDateStr);

    const endDate = new Date(endDateStr);
    // Ajustamos la hora para asegurarnos de que cubra todo el día de fin.
    endDate.setUTCHours(23, 59, 59, 999);

    const query = this.ticketRepository
      .createQueryBuilder('ticket')
      .innerJoin('ticket.items', 'ticketItem')
      .innerJoin('ticketItem.menuItem', 'menuItem')
      .select('menuItem.name', 'name')
      .addSelect('SUM(ticketItem.quantity)', 'totalConsumed')
      .where('ticket.companyId = :tenantId', { tenantId })
      .andWhere('ticket.status = :status', { status: TicketStatus.USED })
      .andWhere('menuItem.isActive = :isActive', { isActive: true })
      .andWhere('ticket.createdAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .groupBy('menuItem.id')
      .addGroupBy('menuItem.name')
      .orderBy('SUM(ticketItem.quantity)', 'DESC')
      .limit(limit);

    const rawReport = await query.getRawMany();
    return rawReport.map((r) => ({
      name: r.name,
      totalConsumed: parseInt(r.totalConsumed, 10),
    }));
  }

  /**
   * Genera un reporte de tendencia de consumo diario por ítem.
   * Muestra la evolución del consumo y permite comparativas.
   * @param dto - DTO con rango de fechas.
   * @param tenantId - ID del tenant.
   * @returns Lista de objetos con fecha, nombre del ítem y cantidad consumida.
   */
  async getConsumptionTrend(dto: GetStockMovementsReportDto, tenantId: number) {
    const { startDate: startDateStr, endDate: endDateStr } = dto;
    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);
    endDate.setUTCHours(23, 59, 59, 999);

    const query = this.ticketRepository
      .createQueryBuilder('ticket')
      .innerJoin('ticket.items', 'ticketItem')
      .innerJoin('ticketItem.menuItem', 'menuItem')
      .select('CAST(ticket.createdAt AS DATE)', 'date')
      .addSelect('menuItem.name', 'itemName')
      .addSelect('SUM(ticketItem.quantity)', 'totalConsumed')
      .where('ticket.companyId = :tenantId', { tenantId })
      .andWhere('ticket.status = :status', { status: TicketStatus.USED })
      .andWhere('menuItem.isActive = :isActive', { isActive: true })
      .andWhere('ticket.createdAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .groupBy('CAST(ticket.createdAt AS DATE)')
      .addGroupBy('menuItem.name')
      .orderBy('date', 'ASC');

    const rawReport = await query.getRawMany();

    return rawReport.map((r) => ({
      date:
        r.date instanceof Date ? r.date.toISOString().split('T')[0] : r.date,
      itemName: r.itemName,
      totalConsumed: parseInt(r.totalConsumed, 10),
    }));
  }

  /**
   * Genera un reporte de la evolución del costo de consumo de ingredientes.
   * Calcula el costo total (cantidad * costo actual) agrupado por día.
   * @param dto - DTO con rango de fechas.
   * @param tenantId - ID del tenant.
   * @returns Lista de objetos con fecha y costo total.
   */
  async getIngredientConsumptionCostEvolution(
    dto: GetStockMovementsReportDto,
    tenantId: number,
  ) {
    const { startDate: startDateStr, endDate: endDateStr } = dto;
    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);
    endDate.setUTCHours(23, 59, 59, 999);

    const query = this.stockMovementRepository
      .createQueryBuilder('movement')
      .leftJoin('movement.ingredient', 'ingredient')
      .select('CAST(movement.createdAt AS DATE)', 'date')
      .addSelect('ingredient.name', 'ingredientName')
      .addSelect(
        'SUM(movement.quantity * COALESCE(ingredient.cost, 0))',
        'dailyIngredientCost',
      )
      .where('movement.companyId = :tenantId', { tenantId })
      .andWhere('movement.movementType = :type', { type: MovementType.OUT })
      .andWhere('movement.createdAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .andWhere('movement.ingredientId IS NOT NULL')
      .andWhere('ingredient.isActive = :isActive', { isActive: true })
      .groupBy('CAST(movement.createdAt AS DATE)')
      .addGroupBy('ingredient.name')
      .orderBy('date', 'ASC');

    const rawReport = await query.getRawMany();

    const reportMap = new Map<
      string,
      {
        date: string;
        totalCost: number;
        details: { ingredientName: string; cost: number }[];
      }
    >();

    for (const row of rawReport) {
      const dateStr =
        row.date instanceof Date
          ? row.date.toISOString().split('T')[0]
          : row.date;
      const cost = parseFloat(row.dailyIngredientCost);

      if (!reportMap.has(dateStr)) {
        reportMap.set(dateStr, { date: dateStr, totalCost: 0, details: [] });
      }

      const entry = reportMap.get(dateStr);
      entry.totalCost += cost;
      entry.details.push({
        ingredientName: row.ingredientName,
        cost,
      });
    }

    return Array.from(reportMap.values());
  }

  /**
   * Genera un reporte de la evolución del costo de consumo de items de menú.
   * Calcula el costo total (cantidad de tickets * costo del item) agrupado por día.
   * @param dto - DTO con rango de fechas.
   * @param tenantId - ID del tenant.
   * @returns Lista de objetos con fecha, costo total y detalle por item.
   */
  async getMenuItemConsumptionCostEvolution(
    dto: GetStockMovementsReportDto,
    tenantId: number,
  ) {
    const { startDate: startDateStr, endDate: endDateStr } = dto;
    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);
    endDate.setUTCHours(23, 59, 59, 999);

    const query = this.ticketRepository
      .createQueryBuilder('ticket')
      .innerJoin('ticket.items', 'ticketItem')
      .innerJoin('ticketItem.menuItem', 'menuItem')
      .select('CAST(ticket.createdAt AS DATE)', 'date')
      .addSelect('menuItem.name', 'menuItemName')
      .addSelect(
        'SUM(ticketItem.quantity * COALESCE(menuItem.cost, 0))',
        'dailyMenuItemCost',
      )
      .where('ticket.companyId = :tenantId', { tenantId })
      .andWhere('ticket.status = :status', { status: TicketStatus.USED })
      .andWhere('menuItem.isActive = :isActive', { isActive: true })
      .andWhere('ticket.createdAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .groupBy('CAST(ticket.createdAt AS DATE)')
      .addGroupBy('menuItem.name')
      .orderBy('date', 'ASC');

    const rawReport = await query.getRawMany();

    const reportMap = new Map<
      string,
      {
        date: string;
        totalCost: number;
        details: { menuItemName: string; cost: number }[];
      }
    >();

    for (const row of rawReport) {
      const dateStr =
        row.date instanceof Date
          ? row.date.toISOString().split('T')[0]
          : row.date;
      const cost = parseFloat(row.dailyMenuItemCost);

      if (!reportMap.has(dateStr)) {
        reportMap.set(dateStr, { date: dateStr, totalCost: 0, details: [] });
      }

      const entry = reportMap.get(dateStr);
      entry.totalCost += cost;
      entry.details.push({
        menuItemName: row.menuItemName,
        cost,
      });
    }

    return Array.from(reportMap.values());
  }

  /**
   * Genera un reporte de Costo Unitario Teórico del Menú (A.K.A. "Costeo de Recetas").
   * Calcula el costo unitario de producir un ítem del menú sumando el costo de todos sus ingredientes según la receta.
   * @param tenantId - ID del tenant.
   * @returns Lista de items de menú con su costo teórico.
   */
  async getTheoreticalMenuCostReport(tenantId: number) {
    // 1. Definir la expresión de cálculo de costo como una constante para reutilizarla
    const theoreticalCostExpression =
      'SUM(COALESCE("recipeIngredient"."quantity", 0) * COALESCE("ingredient"."cost", 0))';

    const query = this.menuItemRepository
      .createQueryBuilder('menuItem')
      .leftJoin('menuItem.recipeIngredients', 'recipeIngredient')
      .leftJoin('recipeIngredient.ingredient', 'ingredient')
      .select('menuItem.name', 'menuItemName')
      // 2. Usar la expresión como SELECT
      .addSelect(theoreticalCostExpression, 'theoreticalCost')
      .where('menuItem.company = :tenantId', { tenantId })
      .andWhere('menuItem.isActive = :isActive', { isActive: true })
      .groupBy('menuItem.id')
      .addGroupBy('menuItem.name')
      // 3. ¡LA SOLUCIÓN! Usar la expresión SQL completa en el ORDER BY
      //    TypeORM lo interpretará como una expresión raw de SQL.
      .orderBy(theoreticalCostExpression, 'DESC'); // <--- CAMBIO CLAVE AQUÍ

    const rawReport = await query.getRawMany();

    return rawReport.map((r) => ({
      menuItemName: r.menuItemName,
      // Asegúrate de que el alias aquí coincida (theoreticalCost)
      theoreticalCost: parseFloat(r.theoreticalCost || '0'),
    }));
  }

  async getInventoryValueReport(tenantId: number) {
    // Obtener ingredientes con stock positivo
    const ingredients = await this.ingredientRepository.find({
      where: {
        company: { id: tenantId },
        quantityInStock: MoreThan(0),
        isActive: true,
      },
      relations: ['category'],
    });

    // Obtener items de menú con stock positivo
    const menuItems = await this.menuItemRepository.find({
      where: {
        company: { id: tenantId },
        stock: MoreThan(0),
        isActive: true,
      },
      relations: ['category'],
    });

    let totalInventoryValue = 0;
    const categoryMap = new Map<string, any>();

    const processItem = (
      name: string,
      categoryName: string,
      quantity: number,
      unitCost: number,
      type: string,
    ) => {
      const value = quantity * unitCost;
      totalInventoryValue += value;

      if (!categoryMap.has(categoryName)) {
        categoryMap.set(categoryName, {
          category: categoryName,
          totalValue: 0,
          items: [],
        });
      }
      const catEntry = categoryMap.get(categoryName);
      catEntry.totalValue += value;
      catEntry.items.push({
        name,
        type,
        quantity,
        unitCost,
        totalValue: value,
      });
    };

    ingredients.forEach((ing) =>
      processItem(
        ing.name,
        ing.category?.name || 'Sin Categoría',
        ing.quantityInStock,
        Number(ing.cost || 0),
        'ingredient',
      ),
    );
    menuItems.forEach((item) =>
      processItem(
        item.name,
        item.category?.name || 'Sin Categoría',
        item.stock,
        Number(item.cost || 0),
        'menu_item',
      ),
    );

    return {
      totalInventoryValue,
      categories: Array.from(categoryMap.values()),
    };
  }

  /**
   * Genera un reporte de Consumo vs. Costo (Análisis de Impacto Presupuestario).
   * Calcula el costo teórico, consumo, costo total y porcentaje de impacto (Pareto).
   * @param dto - DTO con rango de fechas.
   * @param tenantId - ID del tenant.
   * @returns Objeto con resumen y lista de items detallada.
   */
  async getConsumptionVsCostReport(
    dto: GetStockMovementsReportDto,
    tenantId: number,
  ) {
    const { startDate: startDateStr, endDate: endDateStr } = dto;
    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);
    endDate.setUTCHours(23, 59, 59, 999);

    // 1. Obtener Costos Teóricos y Fijos de todos los MenuItems
    // Se calcula el costo de receta (suma de ingredientes) y se trae el costo fijo.
    const menuItemsQuery = this.menuItemRepository
      .createQueryBuilder('menuItem')
      .leftJoin('menuItem.recipeIngredients', 'recipeIngredient')
      .leftJoin('recipeIngredient.ingredient', 'ingredient')
      .select('menuItem.id', 'id')
      .addSelect('menuItem.name', 'name')
      .addSelect('menuItem.cost', 'fixedCost')
      .addSelect(
        'SUM(COALESCE(recipeIngredient.quantity, 0) * COALESCE(ingredient.cost, 0))',
        'calculatedCost',
      )
      .where('menuItem.company = :tenantId', { tenantId })
      // No filtramos por isActive para incluir items que pudieron consumirse pero ya no están activos.
      .groupBy('menuItem.id')
      .addGroupBy('menuItem.name')
      .addGroupBy('menuItem.cost');

    const menuItems = await menuItemsQuery.getRawMany();

    // 2. Obtener Consumo (Conteo de Tickets Usados por Item)
    // Evitamos el producto cartesiano haciendo esta consulta por separado.
    const consumptionQuery = this.ticketRepository
      .createQueryBuilder('ticket')
      .innerJoin('ticket.items', 'ticketItem')
      .innerJoin('ticketItem.menuItem', 'menuItem')
      .select('menuItem.id', 'menuItemId')
      .addSelect('SUM(ticketItem.quantity)', 'totalConsumed')
      .where('ticket.companyId = :tenantId', { tenantId })
      .andWhere('ticket.status = :status', { status: TicketStatus.USED })
      .andWhere('ticket.createdAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .groupBy('menuItem.id');

    const consumptionResults = await consumptionQuery.getRawMany();

    // Mapa para acceso rápido al consumo
    const consumptionMap = new Map<number, number>();
    consumptionResults.forEach((r) => {
      consumptionMap.set(Number(r.menuItemId), parseInt(r.totalConsumed, 10));
    });

    // 3. Procesar y Combinar Datos
    let totalPeriodCost = 0;
    let totalItemsServed = 0;

    const reportItems = menuItems.map((item) => {
      const id = Number(item.id);
      const name = item.name;
      const fixedCost = parseFloat(item.fixedCost || '0');
      const calculatedCost = parseFloat(item.calculatedCost || '0');
      const totalConsumed = consumptionMap.get(id) || 0;

      // Lógica de Negocio: Si tiene costo calculado (ingredientes), se usa ese.
      // Si es 0, se asume que es un item simple y se usa el costo fijo.
      const unitCost = calculatedCost > 0 ? calculatedCost : fixedCost;
      const totalCost = unitCost * totalConsumed;

      totalPeriodCost += totalCost;
      totalItemsServed += totalConsumed;

      return {
        name,
        unitCost,
        totalConsumed,
        totalCost,
        impactPercentage: 0, // Se calcula después
      };
    });

    // 4. Calcular Porcentaje de Impacto y Ordenar (Pareto)
    // Filtramos items con consumo 0 para limpiar el reporte, o los dejamos según preferencia.
    // Para un análisis de impacto, lo que no se consumió no impacta el presupuesto.
    // Sin embargo, el usuario pidió "Métricas de Consumo", ver 0 puede ser útil.
    // Mantendremos todos, pero ordenamos por Costo Total descendente.

    const finalItems = reportItems.map((item) => ({
      ...item,
      impactPercentage:
        totalPeriodCost > 0 ? (item.totalCost / totalPeriodCost) * 100 : 0,
    }));

    // Ordenar descendente por Costo Total (Impacto)
    finalItems.sort((a, b) => b.totalCost - a.totalCost);

    return {
      period: { start: startDate, end: endDate },
      summary: {
        totalPeriodCost,
        totalItemsServed,
      },
      items: finalItems,
    };
  }

  /**
   * Genera un reporte detallado de costos desglosado por Día, Turno e Ítem.
   * Permite analizar en qué momentos (turnos) y productos se concentra el gasto.
   * @param dto - DTO con rango de fechas.
   * @param tenantId - ID del tenant.
   * @returns Estructura jerárquica: Día -> Turnos -> Items con costos.
   */
  async getDetailedCostAnalysis(
    dto: GetStockMovementsReportDto,
    tenantId: number,
  ) {
    const { startDate: startDateStr, endDate: endDateStr } = dto;
    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);
    endDate.setUTCHours(23, 59, 59, 999);

    // 1. Pre-calcular costos unitarios de todos los items (Costo Receta vs Costo Fijo)
    // Esto asegura que usemos el costo real de los ingredientes si el item tiene receta.
    const menuItemsQuery = this.menuItemRepository
      .createQueryBuilder('menuItem')
      .leftJoin('menuItem.recipeIngredients', 'recipeIngredient')
      .leftJoin('recipeIngredient.ingredient', 'ingredient')
      .select('menuItem.id', 'id')
      .addSelect('menuItem.cost', 'fixedCost')
      .addSelect(
        'SUM(COALESCE(recipeIngredient.quantity, 0) * COALESCE(ingredient.cost, 0))',
        'calculatedCost',
      )
      .where('menuItem.company = :tenantId', { tenantId })
      .groupBy('menuItem.id')
      .addGroupBy('menuItem.cost');

    const menuItemsCosts = await menuItemsQuery.getRawMany();
    const costMap = new Map<number, number>();

    menuItemsCosts.forEach((row) => {
      const fixed = parseFloat(row.fixedCost || '0');
      const calculated = parseFloat(row.calculatedCost || '0');
      // Prioridad al costo calculado (receta) si es mayor a 0
      costMap.set(row.id, calculated > 0 ? calculated : fixed);
    });

    // 2. Obtener consumo desglosado por Día, Turno e Item
    const query = this.ticketRepository
      .createQueryBuilder('ticket')
      .leftJoin('ticket.shift', 'shift') // Left join para incluir tickets sin turno si los hubiera
      .innerJoin('ticket.items', 'ticketItem')
      .innerJoin('ticketItem.menuItem', 'menuItem')
      .select('CAST(ticket.createdAt AS DATE)', 'date')
      .addSelect('shift.name', 'shiftName')
      .addSelect('menuItem.id', 'menuItemId')
      .addSelect('menuItem.name', 'menuItemName')
      .addSelect('SUM(ticketItem.quantity)', 'quantity')
      .where('ticket.companyId = :tenantId', { tenantId })
      .andWhere('ticket.status = :status', { status: TicketStatus.USED })
      .andWhere('ticket.createdAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .groupBy('CAST(ticket.createdAt AS DATE)')
      .addGroupBy('shift.name')
      .addGroupBy('menuItem.id')
      .addGroupBy('menuItem.name')
      .orderBy('date', 'ASC')
      .addOrderBy('shift.name', 'ASC');

    const rawData = await query.getRawMany();

    // 3. Estructurar el reporte jerárquicamente
    const reportMap = new Map<string, any>();

    for (const row of rawData) {
      const date =
        row.date instanceof Date
          ? row.date.toISOString().split('T')[0]
          : row.date;
      const shiftName = row.shiftName || 'Sin Turno';
      const menuItemId = Number(row.menuItemId);
      const quantity = parseInt(row.quantity, 10);
      const unitCost = costMap.get(menuItemId) || 0;
      const totalCost = unitCost * quantity;

      if (!reportMap.has(date)) {
        reportMap.set(date, {
          date,
          totalDailyCost: 0,
          shifts: new Map<string, any>(),
        });
      }
      const dayEntry = reportMap.get(date);

      if (!dayEntry.shifts.has(shiftName)) {
        dayEntry.shifts.set(shiftName, {
          shiftName,
          totalShiftCost: 0,
          items: [],
        });
      }
      const shiftEntry = dayEntry.shifts.get(shiftName);

      shiftEntry.items.push({
        menuItemName: row.menuItemName,
        quantity,
        unitCost,
        totalCost,
      });
      shiftEntry.totalShiftCost += totalCost;
      dayEntry.totalDailyCost += totalCost;
    }

    // Convertir Maps a Arrays para el formato JSON final
    return Array.from(reportMap.values()).map((day) => ({
      ...day,
      shifts: Array.from(day.shifts.values()),
    }));
  }

  /**
   * Agrega todos los reportes en una sola estructura para facilitar la exportación (PDF/Excel).
   * Ejecuta las consultas en paralelo.
   * @param dto - DTO con rango de fechas y filtros.
   * @param tenantId - ID del tenant.
   * @returns Objeto con todos los datos de los reportes.
   */
  async getGeneralReport(dto: GetStockMovementsReportDto, tenantId: number) {
    const [
      stockMovements,
      mostConsumedItems,
      consumptionTrend,
      ingredientCostEvolution,
      menuItemCostEvolution,
      inventoryValue,
      consumptionVsCost,
      theoreticalMenuCost,
      detailedCostAnalysis,
    ] = await Promise.all([
      this.getStockMovementsReport(dto, tenantId),
      this.getMostConsumedItems(dto, tenantId),
      this.getConsumptionTrend(dto, tenantId),
      this.getIngredientConsumptionCostEvolution(dto, tenantId),
      this.getMenuItemConsumptionCostEvolution(dto, tenantId),
      this.getInventoryValueReport(tenantId),
      this.getConsumptionVsCostReport(dto, tenantId),
      this.getTheoreticalMenuCostReport(tenantId),
      this.getDetailedCostAnalysis(dto, tenantId),
    ]);

    return {
      meta: {
        generatedAt: new Date(),
        period: {
          startDate: dto.startDate,
          endDate: dto.endDate,
        },
      },
      data: {
        stockMovements,
        mostConsumedItems,
        consumptionTrend,
        ingredientCostEvolution,
        menuItemCostEvolution,
        inventoryValue,
        consumptionVsCost,
        theoreticalMenuCost,
        detailedCostAnalysis,
      },
    };
  }
}
