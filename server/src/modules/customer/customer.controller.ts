import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common'
import { CustomerService } from './customer.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { AdminGuard } from '../../common/guards/admin.guard'

@Controller('admin/customers')
@UseGuards(JwtAuthGuard, AdminGuard)
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @Get()
  list(@Query() query: any) {
    return this.customerService.findAll(query)
  }

  // 注意：必须放在 :id 之前，否则 'stats' 会被 ParseIntPipe 拦下
  @Get('stats')
  stats() {
    return this.customerService.getStats()
  }

  @Get(':id')
  detail(@Param('id', ParseIntPipe) id: number) {
    return this.customerService.findById(id)
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.customerService.update(id, body)
  }
}
