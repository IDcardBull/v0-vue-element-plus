import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common'
import { RoleService } from './role.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { AdminGuard } from '../../common/guards/admin.guard'

@Controller('admin/roles')
@UseGuards(JwtAuthGuard, AdminGuard)
export class RoleController {
  constructor(private roleService: RoleService) {}

  @Get()
  findAll() {
    return this.roleService.findAll()
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.roleService.findById(id)
  }

  @Post()
  create(@Body() body: any) {
    return this.roleService.create(body)
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.roleService.update(id, body)
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.roleService.remove(id)
  }

  @Patch(':id/permissions')
  updatePermissions(@Param('id', ParseIntPipe) id: number, @Body() body: { permissions: string[] }) {
    return this.roleService.updatePermissions(id, body.permissions)
  }
}
