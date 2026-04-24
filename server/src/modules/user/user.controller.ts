import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { UserService } from './user.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { AdminGuard } from '../../common/guards/admin.guard'

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class UserController {
  constructor(private userService: UserService) {}

  // ============ 零售客户 ============
  @Get('customers')
  findCustomers(@Query() query: any) {
    return this.userService.findCustomers(query)
  }

  @Get('customers/:id')
  findCustomer(@Param('id', ParseIntPipe) id: number) {
    return this.userService.findCustomerById(id)
  }

  @Patch('customers/:id')
  updateCustomer(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.userService.updateCustomer(id, body)
  }

  // ============ 分销商 ============
  @Get('distributors')
  findDistributors(@Query() query: any) {
    return this.userService.findDistributors(query)
  }

  @Get('distributors/:id')
  findDistributor(@Param('id', ParseIntPipe) id: number) {
    return this.userService.findDistributorById(id)
  }

  @Patch('distributors/:id')
  updateDistributor(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.userService.updateDistributor(id, body)
  }

  @Post('distributors/:id/audit')
  auditDistributor(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { pass: boolean; remark?: string },
  ) {
    return this.userService.auditDistributor(id, body.pass, body.remark)
  }
}
