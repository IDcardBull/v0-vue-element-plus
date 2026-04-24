import { Body, Controller, Get, Param, ParseIntPipe, Patch } from '@nestjs/common'
import { IsInt } from 'class-validator'
import { SkuService } from './sku.service'

class UpdateStockDto {
  @IsInt()
  stock: number
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
}
