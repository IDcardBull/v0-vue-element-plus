import { Body, Controller, Get, Param, ParseIntPipe, Patch } from '@nestjs/common'
import { IsInt, IsNumber, IsOptional, Min } from 'class-validator'
import { SkuService } from './sku.service'

class UpdateStockDto {
  @IsInt()
  stock: number
}

class UpdatePriceDto {
  // 零售价（必填或与 memberPrice 二选一）
  @IsOptional() @IsNumber() @Min(0)
  retailPrice?: number
  // 会员价（可选）
  @IsOptional() @IsNumber() @Min(0)
  memberPrice?: number
}

@Controller('admin/sku')
export class SkuController {
  constructor(private readonly svc: SkuService) {}

  @Get('by-product/:productId')
  listByProduct(@Param('productId', ParseIntPipe) pid: number) {
    return this.svc.findByProduct(pid)
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.svc.findById(id)
  }

  @Patch(':id/stock')
  updateStock(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateStockDto) {
    return this.svc.updateStock(id, dto.stock)
  }

  /**
   * 修改 SKU 价格（零售/会员价）
   * 批发阶梯价由 priceTiers 表管理，本接口只动 SKU 自身的 retailPrice/memberPrice
   */
  @Patch(':id/price')
  updatePrice(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePriceDto) {
    return this.svc.updatePrice(id, dto)
  }
}
