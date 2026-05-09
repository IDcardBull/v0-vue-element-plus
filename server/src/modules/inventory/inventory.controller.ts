import { Controller, Get, Query } from '@nestjs/common'
import { IsOptional } from 'class-validator'
import { InventoryService } from './inventory.service'
import { PaginationDto } from '@/common/dto/pagination.dto'

class StockQueryDto extends PaginationDto {
  @IsOptional() keyword?: string
  @IsOptional() warehouseId?: number
  @IsOptional() categoryId?: number
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
}
