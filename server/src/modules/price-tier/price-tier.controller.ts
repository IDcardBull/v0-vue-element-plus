import { Body, Controller, Get, Param, ParseIntPipe, Put, Query } from '@nestjs/common'
import { IsArray, IsInt, IsOptional } from 'class-validator'
import { PriceTierService } from './price-tier.service'

class ReplaceTiersDto {
  @IsArray()
  tiers: Array<{ minQty: number; maxQty?: number | null; price: number }>
}

@Controller('admin/price-tier')
export class PriceTierController {
  constructor(private readonly svc: PriceTierService) {}

  @Get('by-sku/:skuId')
  list(@Param('skuId', ParseIntPipe) skuId: number) {
    return this.svc.listBySku(skuId)
  }

  @Put('by-sku/:skuId')
  replace(@Param('skuId', ParseIntPipe) skuId: number, @Body() dto: ReplaceTiersDto) {
    return this.svc.replace(skuId, dto.tiers)
  }

  @Get('match')
  match(
    @Query('skuId', ParseIntPipe) skuId: number,
    @Query('qty', ParseIntPipe) qty: number,
  ) {
    return this.svc.matchPrice(skuId, qty)
  }
}
