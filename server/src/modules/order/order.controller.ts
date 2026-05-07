import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common'
import { IsArray, IsInt, IsNotEmpty, IsOptional } from 'class-validator'
import { OrderService, OrderStatus } from './order.service'
import { CurrentUser, JwtPayload } from '@/common/decorators/current-user.decorator'
import { PaginationDto } from '@/common/dto/pagination.dto'

class AdminQueryDto extends PaginationDto {
  @IsOptional() orderNo?: string
  @IsOptional() channel?: string
  @IsOptional() status?: OrderStatus
  @IsOptional() dateFrom?: string
  @IsOptional() dateTo?: string
}

class ShipDto {
  // 兼容前端 { logisticsCompany, logisticsNo } 与 { company, trackingNo }
  @IsOptional() company?: string
  @IsOptional() trackingNo?: string
  @IsOptional() logisticsCompany?: string
  @IsOptional() logisticsNo?: string
  @IsOptional() remark?: string
}

class CloseDto {
  @IsOptional() reason?: string
}

class RefundDto {
  @IsOptional() amount?: number
  @IsOptional() reason?: string
}

class CreateOrderDto {
  @IsNotEmpty() channel: 'retail' | 'wholesale'
  @IsArray() items: Array<{ skuId: number; qty: number }>
  @IsOptional() @IsInt() addressId?: number
  @IsOptional() freight?: number
  @IsOptional() remark?: string
  @IsOptional() useCredit?: boolean
  @IsOptional() payMethod?: string
  @IsOptional() source?: string
}

// ========== 管理端 ==========
@Controller('admin/orders')
export class OrderController {
  constructor(private readonly svc: OrderService) {}

  @Get()
  list(@Query() q: AdminQueryDto) {
    return this.svc.search(q)
  }

  @Get('status-counts')
  counts(@Query('channel') channel?: string) {
    return this.svc.statusCounts({ channel })
  }

  @Get(':id')
  detail(@Param('id', ParseIntPipe) id: number) {
    return this.svc.findById(id)
  }

  @Get(':id/logistics')
  logistics(@Param('id', ParseIntPipe) id: number) {
    return this.svc.getLogistics(id)
  }

  @Patch(':id/mark-paid')
  markPaid(@Param('id', ParseIntPipe) id: number) {
    return this.svc.markPaid(id)
  }

  @Post(':id/mark-paid')
  markPaidPost(@Param('id', ParseIntPipe) id: number) {
    return this.svc.markPaid(id)
  }

  @Patch(':id/ship')
  ship(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ShipDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const company = dto.company || dto.logisticsCompany || ''
    const trackingNo = dto.trackingNo || dto.logisticsNo || ''
    return this.svc.ship(id, company, trackingNo, user.username)
  }

  @Post(':id/ship')
  shipPost(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ShipDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const company = dto.company || dto.logisticsCompany || ''
    const trackingNo = dto.trackingNo || dto.logisticsNo || ''
    return this.svc.ship(id, company, trackingNo, user.username)
  }

  @Patch(':id/complete')
  complete(@Param('id', ParseIntPipe) id: number) {
    return this.svc.complete(id)
  }

  @Post(':id/complete')
  completePost(@Param('id', ParseIntPipe) id: number) {
    return this.svc.complete(id)
  }

  @Patch(':id/close')
  close(@Param('id', ParseIntPipe) id: number, @Body() dto: CloseDto) {
    return this.svc.close(id, dto.reason)
  }

  @Post(':id/close')
  closePost(@Param('id', ParseIntPipe) id: number, @Body() dto: CloseDto) {
    return this.svc.close(id, dto.reason)
  }

  @Post(':id/refund')
  refund(@Param('id', ParseIntPipe) id: number, @Body() dto: RefundDto) {
    return this.svc.refund(id, dto.amount, dto.reason)
  }

  // 客户端入口 —— 小程序/H5 下单走这里
  @Post('client/create')
  clientCreate(@CurrentUser() user: JwtPayload, @Body() dto: CreateOrderDto) {
    if (user.userType !== 'client') throw new Error('仅客户可下单')
    return this.svc.createOrder({ ...dto, userId: user.sub })
  }
}
