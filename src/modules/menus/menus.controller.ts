import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { MenusService } from './menus.service';
import { CreateMenuDto } from './dto/create-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';
import { AddMenuOptionDto } from './dto/add-menu-option.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from 'src/common/guards/tenant-guard';
import { Tenant } from 'src/common/decorators/tenant-decorator';

@ApiTags('Menus')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('menus')
export class MenusController {
  constructor(private readonly menusService: MenusService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new menu' })
  @ApiResponse({ status: 201, description: 'The menu has been successfully created.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  create(@Body() createMenuDto: CreateMenuDto, @Tenant() companyId: number) {
    return this.menusService.create(createMenuDto, companyId);
  }

  @Get()
  @ApiOperation({ summary: 'List all menus for the company' })
  @ApiResponse({ status: 200, description: 'List of menus.' })
  findAll(@Tenant() companyId: number) {
    return this.menusService.findAll(companyId);
  }
  
  @Get('published')
  @ApiOperation({ summary: 'List all currently published and active menus for users' })
  @ApiResponse({ status: 200, description: 'List of published menus.' })
  findPublished(@Tenant() companyId: number) {
    return this.menusService.findPublishedForUser(companyId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single menu by ID' })
  @ApiResponse({ status: 200, description: 'The menu details.' })
  @ApiResponse({ status: 404, description: 'Menu not found.' })
  findOne(@Param('id') id: string, @Tenant() companyId: number) {
    return this.menusService.findOne(id, companyId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a menu' })
  @ApiResponse({ status: 200, description: 'The menu has been successfully updated.' })
  @ApiResponse({ status: 404, description: 'Menu not found.' })
  update(@Param('id') id: string, @Body() updateMenuDto: UpdateMenuDto, @Tenant() companyId: number) {
    return this.menusService.update(id, updateMenuDto, companyId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a menu' })
  @ApiResponse({ status: 204, description: 'The menu has been successfully deleted.' })
  @ApiResponse({ status: 404, description: 'Menu not found.' })
  remove(@Param('id') id: string, @Tenant() companyId: number) {
    return this.menusService.remove(id, companyId);
  }
  
  @Post('options')
  @ApiOperation({ summary: 'Add a menu option to a menu day' })
  @ApiResponse({ status: 201, description: 'The menu option has been successfully added.' })
  @ApiResponse({ status: 400, description: 'Invalid input data.' })
  @ApiResponse({ status: 404, description: 'Active menu for the date not found.' })
  addOption(@Body() addMenuOptionDto: AddMenuOptionDto, @Tenant() companyId: number) {
    return this.menusService.addOption(addMenuOptionDto, companyId);
  }
}
