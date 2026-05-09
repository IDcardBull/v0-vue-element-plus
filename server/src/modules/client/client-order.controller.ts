import {
  BadRequestException,
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
import { PrismaService } from '@/common/prisma.service'
import {
  calcShippingByTemplate,
  ShippingItemInput,
  ShippingTemplateLike,
} from '../shipping-template/shipping-template.calc'

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

class PreviewOrderDto {
  @IsOptional() @IsString()
  channel?: 'retail' | 'wholesale'

  @IsArray()
  @ArrayMinSize(1, { message: '商品不能为空' })
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[]

  /** 用户已选地址 id —— 算运费时按该地址 province 匹配模板特殊地区 / 满额包邮 */
  @IsOptional() @IsInt()
  addressId?: number
}


@Controller('client/orders')
export class ClientOrderController {
  constructor(
    private readonly orderSvc: OrderService,
    private readonly prisma: PrismaService,
  ) {}

  private ensureClient(user: JwtPayload) {
    if (user.userType !== 'client') throw new ForbiddenException('仅小程序用户可下单')
  }

  /**
   * 结算页运费试算 —— 不落库，纯计算
   * 输入：商品列表 + 收货地址 id（可选）
   * 输出：商品小计、运费、应付、按模板分组的运费明细
   * 与 createOrder 共用同一份 calcShippingByTemplate，保证下单时金额一致
   */
  @Post('preview')
  async preview(@CurrentUser() user: JwtPayload, @Body() dto: PreviewOrderDto) {
    this.ensureClient(user)
    if (!dto.items?.length) throw new BadRequestException('商品不能为空')

    // 取地址省份（没传地址 → 用默认地址；都没有 → null，按全国默认规则）
    let province: string | null = null
    if (dto.addressId) {
      const addr = await this.prisma.address.findFirst({
        where: { id: Number(dto.addressId), userId: user.sub },
      })
      if (!addr) throw new BadRequestException('地址不存在')
      province = addr.province
    } else {
      const def = await this.prisma.address.findFirst({
        where: { userId: user.sub, isDefault: true },
      })
      province = def?.province || null
    }

    const channel = dto.channel === 'wholesale' ? 'wholesale' : 'retail'

    let totalAmount = 0
    let legacyMaxFee = 0
    let legacyAllFree = true
    let legacyHasItem = false
    const legacyProductNames: string[] = [] // 没挂模板的商品名
    const templateGroups = new Map<
      number,
      { template: ShippingTemplateLike; items: ShippingItemInput[]; templateName: string }
    >()

    for (const it of dto.items) {
      const sku = await this.prisma.sku.findUnique({
        where: { id: Number(it.skuId) },
        include: { product: { include: { shippingTemplate: true } } },
      })
      if (!sku) throw new BadRequestException(`SKU ${it.skuId} 不存在`)
      const product: any = sku.product
      // 价格：批发渠道用阶梯价首档，零售用 SKU 售价
      const unitPrice =
        channel === 'wholesale'
          ? Number(sku.wholesalePrice ?? sku.price ?? 0)
          : Number(sku.price ?? 0)
      const qty = Math.max(1, Number(it.qty) || 1)
      const subtotal = unitPrice * qty
      totalAmount += subtotal

      if (product.shippingTemplate) {
        const tpl: ShippingTemplateLike = product.shippingTemplate
        const group = templateGroups.get(tpl.id) || {
          template: tpl,
          items: [],
          templateName: (product.shippingTemplate as any).name,
        }
        group.items.push({
          qty,
          weight: sku.weight == null ? 0 : Number(sku.weight),
          subtotal,
        })
        templateGroups.set(tpl.id, group)
      } else {
        legacyHasItem = true
        legacyProductNames.push(product.name)
        const free = product.freeShipping === true
        const fee = Number(product.shippingFee || 0)
        if (!free) {
          legacyAllFree = false
          if (fee > legacyMaxFee) legacyMaxFee = fee
        }
      }
    }

    /**
     * breakdown 给前端展示：每条都附带 reason，方便定位"为啥是 0 元"
     *   - 'template'         按模板算出的运费（>0 也回传 reason='template'）
     *   - 'free_shipping'    模板满额包邮命中
     *   - 'no_first_rule'    模板默认规则 firstAmount/firstPrice=0
     *   - 'legacy'           商品未挂模板，走老 freeShipping/shippingFee
     *   - 'legacy_all_free'  商品未挂模板且全部 freeShipping=true
     */
    const breakdown: Array<{
      templateId: number | null
      templateName: string
      freight: number
      reason: string
    }> = []

    let templateFreight = 0
    for (const [tplId, { template, items, templateName }] of templateGroups.entries()) {
      const f = calcShippingByTemplate(template, items, province)
      templateFreight += f
      let reason = 'template'
      if (f === 0) {
        const def: any = template.defaultRule || {}
        const firstAmount = Number(def.firstAmount) || 0
        const firstPrice = Number(def.firstPrice) || 0
        if (template.freeShippingEnabled) reason = 'free_shipping'
        else if (firstAmount <= 0 || firstPrice <= 0) reason = 'no_first_rule'
      }
      breakdown.push({ templateId: tplId, templateName, freight: f, reason })
    }

    const legacyFreight = legacyHasItem ? (legacyAllFree ? 0 : legacyMaxFee) : 0
    if (legacyHasItem) {
      breakdown.push({
        templateId: null,
        templateName: legacyProductNames.length
          ? `未配模板：${legacyProductNames.slice(0, 3).join('、')}${legacyProductNames.length > 3 ? '…' : ''}`
          : '默认运费',
        freight: legacyFreight,
        reason: legacyAllFree ? 'legacy_all_free' : 'legacy',
      })
    }

    const freight = Math.round((templateFreight + legacyFreight) * 100) / 100
    const payAmount = Math.round((totalAmount + freight) * 100) / 100

    return {
      totalAmount: Math.round(totalAmount * 100) / 100,
      freight,
      payAmount,
      province, // 让前端知道按哪个省算的
      breakdown, // 给前端可选展示「按模板分组的运费」+ 每段为何是 0
    }
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
      payMethod: dto.payMethod || (channel === 'wholesale' ? 'offline' : 'wechat'),
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
