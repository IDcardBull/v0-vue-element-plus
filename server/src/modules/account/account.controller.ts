import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { AccountService } from './account.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { AdminGuard } from '../../common/guards/admin.guard'

@Controller('admin/accounts')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AccountController {
  constructor(private accountService: AccountService) {}

  @Get()
  findAll(@Query() query: any) {
    return this.accountService.findAll(query)
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.accountService.findById(id)
  }

  @Post()
  create(@Body() body: any) {
    return this.accountService.create(body)
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.accountService.update(id, body)
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.accountService.remove(id)
  }

  @Post(':id/reset-password')
  resetPassword(@Param('id', ParseIntPipe) id: number, @Body() body: { password?: string }) {
    return this.accountService.resetPassword(id, body.password)
  }
}
