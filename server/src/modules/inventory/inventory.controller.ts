import { Body, Controller, Get, Param, ParseIntPipe, Patch, Query } from '@nestjs/common'
import { IsInt, IsOptional, Min } from 'class-validator'
import { Type } from 'class-transformer'
import { InventoryService } from './inventory.service'
import { PaginationDto } from '@/common/dto/pagination.dto'

class StockQueryDto extends PaginationDto {
  @IsOptional() keyword?: string
  @IsOptional() skuCode?: string
  @IsOptional() productName?: string
  @IsOptional() spec?: string
  @IsOptional() @Type(() => Number) warehouseId?: number
  @IsOptional() @Type(() => Number) categoryId?: number
}

class UpdateStockDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  onHand: number
}

/**
 * 简化版（v2，2026-05）库存接口：
 * - GET /admin/inventory/warehouses 仓库列表
 * - GET /admin/inventory/stocks     SKU + 数量分页
 * 已下线：op / stock-in / stock-out / adjust / records / warnings
 */
@Controller('admin/inventory')
export class InventoryController {
  constructor(private readonly svc: InventoryService) {}

  @Get('warehouses')
  warehouses() {
    return this.svc.warehouses()
  }

  @Get('stocks')
  stocks(@Query() q: StockQueryDto) {
    return this.svc.stockList(q)
  }

  @Patch('stocks/:id')
  updateStock(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateStockDto) {
    return this.svc.updateStock(id, dto.onHand)
  }
}
