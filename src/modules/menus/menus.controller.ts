import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { MenusService } from './menus.service';
import { CreateMenuDto } from './dto/create-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';
import { AddMenuOptionDto } from './dto/add-menu-option.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from 'src/common/guards/tenant-guard';
import { Tenant } from 'src/common/decorators/tenant-decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

/**
 * Controller for managing menus.
 * Provides API endpoints for creating, retrieving, updating, and deleting menus,
 * as well as adding options to specific menu days.
 * All endpoints are protected by JWT authentication and tenant-based access control.
 */
@ApiTags('Menus')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('menus')
export class MenusController {
  constructor(private readonly menusService: MenusService) {}

  /**
   * Creates a new menu for the current company.
   * This endpoint is accessible to authenticated users with appropriate permissions.
   *
   * @param createMenuDto - The data to create the new menu.
   * @param companyId - The ID of the company derived from the tenant context.
   * @returns The newly created menu.
   */
  @Post()
  @ApiOperation({
    summary: 'Create a new menu',
    description:
      'Creates a new menu with specified details for the authenticated company.',
  })
  @ApiResponse({
    status: 201,
    description: 'The menu has been successfully created.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden. Tenant access denied.' })
  create(@Body() createMenuDto: CreateMenuDto, @Tenant() companyId: number) {
    return this.menusService.create(createMenuDto, companyId);
  }

  /**
   * Retrieves all menus belonging to the current company.
   *
   * @param companyId - The ID of the company derived from the tenant context.
   * @returns A list of all menus for the company.
   */
  @Get()
  @ApiOperation({
    summary: 'List all menus for the company',
    description:
      'Retrieves a list of all menus associated with the authenticated company.',
  })
  @ApiResponse({ status: 200, description: 'List of menus.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden. Tenant access denied.' })
  findAll(@Tenant() companyId: number) {
    return this.menusService.findAll(companyId);
  }

  /**
   * Retrieves all currently published and active menus for users within the current company.
   * This endpoint is typically used by client-side applications to display available menus.
   *
   * @param companyId - The ID of the company derived from the tenant context.
   * @param user - The authenticated user.
   * @returns A list of published and active menus.
   */
  @Get('published')
  @ApiOperation({
    summary: 'List all currently published and active menus for users',
    description:
      'Fetches menus that are currently published and within their active date range for the authenticated company.',
  })
  @ApiResponse({ status: 200, description: 'List of published menus.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden. Tenant access denied.' })
  findPublished(@Tenant() companyId: number, @CurrentUser() user: User) {
    const isDiner = user.role === 'diner';
    return this.menusService.findPublishedForUser(companyId, user.id, isDiner);
  }

  /**
   * Retrieves a single menu by its ID for the current company.
   * Includes details of menu days, options, and associated shifts.
   *
   * @param id - The ID of the menu to retrieve.
   * @param companyId - The ID of the company derived from the tenant context.
   * @returns The requested menu details.
   * @throws NotFoundException if the menu does not exist or does not belong to the company.
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Get a single menu by ID',
    description:
      'Retrieves a specific menu by its unique ID for the authenticated company, including its full structure of days, options, and shifts.',
  })
  @ApiParam({ name: 'id', description: 'Unique identifier of the menu' })
  @ApiResponse({ status: 200, description: 'The menu details.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden. Tenant access denied.' })
  @ApiResponse({ status: 404, description: 'Menu not found for this company.' })
  findOne(@Param('id') id: string, @Tenant() companyId: number) {
    return this.menusService.findOne(id, companyId);
  }

  /**
   * Retrieves all menu options by day for a menu, with compatibility info for the user.
   *
   * @param id - The ID of the menu.
   * @param companyId - The ID of the company.
   * @param user - The authenticated user.
   */
  @Get(':id/options')
  @ApiOperation({
    summary: 'Get all menu options by day for a menu',
    description:
      'Retrieves all menu days and their associated options (menu items and shifts) for a specific menu identified by its ID.',
  })
  @ApiParam({ name: 'id', description: 'Unique identifier of the menu' })
  @ApiResponse({ status: 200, description: 'List of menu days with options.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden. Tenant access denied.' })
  @ApiResponse({ status: 404, description: 'Menu not found for this company.' })
  getMenuOptionsByDay(
    @Param('id') id: string,
    @Tenant() companyId: number,
    @CurrentUser() user: User,
  ) {
    const isDiner = user.role === 'diner';
    return this.menusService.getMenuOptionsByDay(
      id,
      companyId,
      user.id,
      isDiner,
    );
  }

  /**
   * Updates an existing menu identified by its ID for the current company.
   *
   * @param id - The ID of the menu to update.
   * @param updateMenuDto - The data to update the menu.
   * @param companyId - The ID of the company derived from the tenant context.
   * @returns The updated menu.
   * @throws NotFoundException if the menu does not exist or does not belong to the company.
   */
  @Patch(':id')
  @ApiOperation({
    summary: 'Update a menu',
    description:
      'Updates an existing menu identified by its ID for the authenticated company.',
  })
  @ApiParam({
    name: 'id',
    description: 'Unique identifier of the menu to update',
  })
  @ApiResponse({
    status: 200,
    description: 'The menu has been successfully updated.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden. Tenant access denied.' })
  @ApiResponse({ status: 404, description: 'Menu not found for this company.' })
  update(
    @Param('id') id: string,
    @Body() updateMenuDto: UpdateMenuDto,
    @Tenant() companyId: number,
  ) {
    return this.menusService.update(id, updateMenuDto, companyId);
  }

  /**
   * Deletes a menu identified by its ID for the current company.
   *
   * @param id - The ID of the menu to delete.
   * @param companyId - The ID of the company derived from the tenant context.
   * @returns No content on successful deletion.
   * @throws NotFoundException if the menu does not exist or does not belong to the company.
   */
  @Delete(':id')
  @ApiOperation({
    summary: 'Delete a menu',
    description:
      'Deletes a menu identified by its ID for the authenticated company.',
  })
  @ApiParam({
    name: 'id',
    description: 'Unique identifier of the menu to delete',
  })
  @ApiResponse({
    status: 204,
    description: 'The menu has been successfully deleted.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden. Tenant access denied.' })
  @ApiResponse({ status: 404, description: 'Menu not found for this company.' })
  remove(@Param('id') id: string, @Tenant() companyId: number) {
    return this.menusService.remove(id, companyId);
  }

  /**
   * Adds a new menu option to a specific menu day.
   * This involves validating shifts and ensuring an active menu exists for the given date.
   *
   * @param addMenuOptionDto - The data to add the new menu option.
   * @param companyId - The ID of the company derived from the tenant context.
   * @returns The newly created menu option.
   * @throws BadRequestException if any shift IDs are invalid or no active menu for the date.
   * @throws NotFoundException if no active menu is found for the specified date.
   */
  @Post('options')
  @ApiOperation({
    summary: 'Add a menu option to a menu day',
    description:
      'Adds a new menu option (dish) to a specific day within an active menu. This links a product to shifts on a particular date.',
  })
  @ApiResponse({
    status: 201,
    description: 'The menu option has been successfully added.',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request. Invalid input data or invalid shifts.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden. Tenant access denied.' })
  @ApiResponse({
    status: 404,
    description: 'Active menu for the date not found for this company.',
  })
  addOption(
    @Body() addMenuOptionDto: AddMenuOptionDto,
    @Tenant() companyId: number,
  ) {
    return this.menusService.addOption(addMenuOptionDto, companyId);
  }

  /**
   * Removes a menu option from a menu planification.
   *
   * @param optionId - The ID of the menu option to delete.
   * @param companyId - The ID of the company derived from the tenant context.
   * @returns No content on successful deletion.
   * @throws NotFoundException if the menu option does not exist or does not belong to the company.
   */
  @Delete('options/:optionId')
  @ApiOperation({
    summary: 'Remove a menu option',
    description:
      'Deletes a specific menu option from its assigned day in a menu planification.',
  })
  @ApiParam({
    name: 'optionId',
    description: 'Unique identifier of the menu option to remove',
  })
  @ApiResponse({
    status: 204,
    description: 'The menu option has been successfully removed.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden. Tenant access denied.' })
  @ApiResponse({
    status: 404,
    description: 'Menu option not found for this company.',
  })
  removeOption(
    @Param('optionId') optionId: string,
    @Tenant() companyId: number,
  ) {
    return this.menusService.removeOption(optionId, companyId);
  }
}
