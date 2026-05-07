import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common'
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  ValidateNested,
  Min,
  MaxLength,
} from 'class-validator'
import { Type } from 'class-transformer'
import { CurrentUser, JwtPayload } from '@/common/decorators/current-user.decorator'
import { OrderService } from '../order/order.service'

class OrderItemDto {
  @IsInt() skuId: number
  @IsInt() @Min(1) qty: number
}

class CreateOrderDto {
  @IsOptional() @IsString()
  channel?: 'retail' | 'wholesale'

  @IsOptional() @IsString()
  source?: string

  @IsArray()
  @ArrayMinSize(1, { message: '商品不能为空' })
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[]

  @IsOptional() @IsInt()
  addressId?: number

  @IsOptional() @IsString() @MaxLength(500)
  remark?: string

  @IsOptional() @IsString()
  payMethod?: string

  @IsOptional()
  useCredit?: boolean
}

class UpdateAddressDto {
  @IsInt() @Min(1)
  addressId: number
}


@Controller('client/orders')
export class ClientOrderController {
  constructor(private readonly orderSvc: OrderService) {}

  private ensureClient(user: JwtPayload) {
    if (user.userType !== 'client') throw new ForbiddenException('仅小程序用户可下单')
  }

  /**
   * 下单（零售渠道，未支付状态）
   * 前端接收订单号后，再调用 POST /client/orders/:id/pay 拿微信支付参数
   */
  @Post()
  async create(@CurrentUser() user: JwtPayload, @Body() dto: CreateOrderDto) {
    this.ensureClient(user)
    const channel = dto.channel === 'wholesale' ? 'wholesale' : 'retail'
    const source = dto.source || (channel === 'wholesale' ? 'miniprogram_b' : 'miniprogram')
    return this.orderSvc.createOrder({
      userId: user.sub,
      channel,
      source,
      items: dto.items,
      addressId: dto.addressId,
      remark: dto.remark,
      payMethod: dto.payMethod || 'wechat',
      useCredit: !!dto.useCredit,
    })
  }

  /**
   * 我的订单列表
   * status: pending_pay | pending_ship | shipped | completed | after_sale | closed | all
   */
  @Get()
  list(
    @CurrentUser() user: JwtPayload,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    this.ensureClient(user)
    return this.orderSvc.search({
      userId: user.sub,
      status: status && status !== 'all' ? (status as any) : undefined,
      page: Number(page) || 1,
      pageSize: Number(pageSize) || 10,
    })
  }

  /** 订单状态徽标数量（我的订单页 Tab 上的小红点） */
  @Get('status-counts')
  counts(@CurrentUser() user: JwtPayload) {
    this.ensureClient(user)
    return this.orderSvc.statusCounts({ userId: user.sub })
  }

  @Get(':id/logistics')
  async logistics(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
  ) {
    this.ensureClient(user)
    const order = await this.orderSvc.findById(id)
    if (order.userId !== user.sub) throw new NotFoundException('订单不存在')
    return this.orderSvc.getLogistics(id)
  }

  @Get(':id')
  async detail(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
  ) {
    this.ensureClient(user)
    const order = await this.orderSvc.findById(id)
    if (order.userId !== user.sub) throw new NotFoundException('订单不存在')
    return order
  }

  /** 用户取消未支付订单 */
  @Patch(':id/cancel')
  async cancel(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { reason?: string } = {},
  ) {
    this.ensureClient(user)
    const order = await this.orderSvc.findById(id)
    if (order.userId !== user.sub) throw new NotFoundException('订单不存在')
    return this.orderSvc.close(id, body.reason || '用户主动取消')
  }

  /** 用户确认收货 */
  @Patch(':id/confirm')
  async confirm(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
  ) {
    this.ensureClient(user)
    const order = await this.orderSvc.findById(id)
    if (order.userId !== user.sub) throw new NotFoundException('订单不存在')
    return this.orderSvc.complete(id)
  }

  /** 更新收货地址（主路径） */
  @Patch(':id/address')
  async updateAddress(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAddressDto,
  ) {
    this.ensureClient(user)
    return this.orderSvc.updateAddress(id, user.sub, Number(dto.addressId))
  }

  /** 更新收货地址（兼容回退路径） */
  @Post('/update-address')
  async updateAddressFallback(
    @CurrentUser() user: JwtPayload,
    @Body() body: { id: number; addressId: number },
  ) {
    this.ensureClient(user)
    return this.orderSvc.updateAddress(Number(body.id), user.sub, Number(body.addressId))
  }
}

@Controller('client/order')
export class ClientOrderCompatController {
  constructor(private readonly orderSvc: OrderService) {}

  @Post('update-address')
  async updateAddressFallback(
    @CurrentUser() user: JwtPayload,
    @Body() body: { id: number; addressId: number },
  ) {
    if (user.userType !== 'client') throw new ForbiddenException('仅小程序用户可下单')
    return this.orderSvc.updateAddress(Number(body.id), user.sub, Number(body.addressId))
  }
}
