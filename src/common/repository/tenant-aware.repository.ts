import {
  Repository,
  SelectQueryBuilder,
  FindOptionsWhere,
  FindOptionsRelations,
  FindOptionsSelect,
  FindOptionsOrder,
} from 'typeorm';
import { BaseTenantEntity } from '../entities/base-tenant.entity';

// Define custom FindOptions interface for tenant-aware methods
interface TenantFindOptions<T> {
  where?: FindOptionsWhere<T>;
  relations?: FindOptionsRelations<T>;
  select?: FindOptionsSelect<T>;
  order?: FindOptionsOrder<T>;
  skip?: number;
  take?: number;
  // Add other standard TypeORM find options as needed
}

export class TenantAwareRepository {
  /**
   * Aplica el filtro de tenant a un QueryBuilder existente.
   *
   * @param qb - QueryBuilder de TypeORM
   * @param companyId - ID de la compañía (tenant)
   * @param alias - Alias de la tabla en la consulta (default: 'entity')
   * @returns QueryBuilder con el filtro de tenant aplicado
   */
  static applyTenantFilter<T extends BaseTenantEntity>(
    qb: SelectQueryBuilder<T>,
    companyId: number,
    alias: string = 'entity',
  ): SelectQueryBuilder<T> {
    return qb.andWhere(`${alias}.companyId = :companyId`, { companyId });
  }

  /**
   * Crea un QueryBuilder con filtro de tenant aplicado.
   *
   * @param repo - Repositorio de TypeORM
   * @param companyId - ID de la compañía (tenant)
   * @param alias - Alias de la tabla (default: 'entity')
   * @returns QueryBuilder con el filtro de tenant aplicado
   */
  static createTenantQueryBuilder<T extends BaseTenantEntity>(
    repo: Repository<T>,
    companyId: number,
    alias: string = 'entity',
  ): SelectQueryBuilder<T> {
    const qb = repo.createQueryBuilder(alias);
    return this.applyTenantFilter(qb, companyId, alias);
  }

  /**
   * Busca una entidad por ID verificando que pertenezca al tenant.
   *
   * @param repo - Repositorio de TypeORM
   * @param id - ID de la entidad
   * @param companyId - ID de la compañía (tenant)
   * @param options - Opciones de búsqueda adicionales (where, relations, etc.)
   * @returns La entidad encontrada o null
   */
  static async findOneByTenant<T extends BaseTenantEntity>(
    repo: Repository<T>,
    id: number | string,
    companyId: number,
    options?: TenantFindOptions<T>,
  ): Promise<T | null> {
    return repo.findOne({
      ...options,
      where: {
        ...options?.where,
        id,
        companyId,
      } as any,
    });
  }

  /**
   * Busca todas las entidades de un tenant.
   *
   * @param repo - Repositorio de TypeORM
   * @param companyId - ID de la compañía (tenant)
   * @param options - Opciones de búsqueda adicionales (where, relations, etc.)
   * @returns Array de entidades del tenant
   */
  static async findAllByTenant<T extends BaseTenantEntity>(
    repo: Repository<T>,
    companyId: number,
    options?: TenantFindOptions<T>,
  ): Promise<T[]> {
    return repo.find({
      ...options,
      where: {
        ...options?.where,
        companyId,
      } as any,
    });
  }

  /**
   * Verifica si una entidad pertenece al tenant.
   *
   * @param repo - Repositorio de TypeORM
   * @param id - ID de la entidad
   * @param companyId - ID de la compañía (tenant)
   * @returns true si la entidad pertenece al tenant, false en caso contrario
   */
  static async belongsToTenant<T extends BaseTenantEntity>(
    repo: Repository<T>,
    id: number,
    companyId: number,
  ): Promise<boolean> {
    const entity = await repo.findOne({
      where: { id, companyId } as unknown as FindOptionsWhere<T>,
    });
    return entity !== null;
  }
}
