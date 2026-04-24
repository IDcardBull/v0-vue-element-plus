import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { IsInt, IsNotEmpty, IsOptional } from 'class-validator'
import { InventoryService } from './inventory.service'
import { CurrentUser, JwtPayload } from '@/common/decorators/current-user.decorator'
import { PaginationDto } from '@/common/dto/pagination.dto'

class StockOpDto {
  @IsNotEmpty() type: 'in' | 'out' | 'transfer' | 'inventory' | 'return'
  @IsInt() skuId: number
  @IsInt() warehouseId: number
  @IsInt() qty: number
  @IsOptional() orderNo?: string
  @IsOptional() remark?: string
  @IsOptional() relatedId?: number
  @IsOptional() relatedType?: string
}

class StockQueryDto extends PaginationDto {
  @IsOptional() keyword?: string
  @IsOptional() warehouseId?: number
  @IsOptional() categoryId?: number
}

class RecordQueryDto extends PaginationDto {
  @IsOptional() type?: 'in' | 'out' | 'transfer' | 'inventory' | 'return'
  @IsOptional() keyword?: string
  @IsOptional() warehouseId?: number
  @IsOptional() dateFrom?: string
  @IsOptional() dateTo?: string
}

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

  @Get('warnings')
  warnings(@Query('level') level?: 'urgent' | 'warning' | 'excess') {
    return this.svc.warnings(level)
  }

  @Get('records')
  records(@Query() q: RecordQueryDto) {
    return this.svc.recordList(q)
  }

  @Post('op')
  async op(@Body() dto: StockOpDto, @CurrentUser() user: JwtPayload) {
    const orderNo =
      dto.orderNo ||
      `${dto.type.toUpperCase()}-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    return this.svc.stockOp({
      orderNo,
      type: dto.type,
      skuId: dto.skuId,
      warehouseId: dto.warehouseId,
      qty: dto.qty,
      operator: user.username,
      remark: dto.remark,
      relatedId: dto.relatedId,
      relatedType: dto.relatedType,
    })
  }
}
