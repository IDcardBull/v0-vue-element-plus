import {
  Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Put, Query,
} from '@nestjs/common'
import { IsArray, IsInt, IsNotEmpty, IsOptional } from 'class-validator'
import { ProductService } from './product.service'
import { PaginationDto } from '@/common/dto/pagination.dto'

class ProductQueryDto extends PaginationDto {
  @IsOptional() keyword?: string
  @IsOptional() categoryId?: number
  @IsOptional() brandId?: number
  @IsOptional() craft?: string
  @IsOptional() status?: number
  @IsOptional() channel?: string // retail / wholesale / all
}

class ProductDto {
  @IsNotEmpty({ message: '商品编码必填' })
  code: string

  @IsNotEmpty({ message: '商品名称必填' })
  name: string

  @IsOptional() @IsInt() categoryId?: number
  @IsOptional() @IsInt() brandId?: number
  @IsOptional() craft?: string
  @IsOptional() material?: string
  @IsOptional() mainImage?: string
  @IsOptional() images?: string[]
  @IsOptional() detail?: string
  @IsOptional() tags?: string[]
  @IsOptional() retailEnabled?: boolean
  @IsOptional() retailPrice?: number
  @IsOptional() memberPrice?: number
  @IsOptional() costPrice?: number
  @IsOptional() promoActivities?: string[]
  @IsOptional() wholesaleEnabled?: boolean
  @IsOptional() minWholesaleQty?: number
  @IsOptional() dealerLevels?: string[]
  @IsOptional() status?: number
  @IsOptional() @IsArray() skus?: any[]
}

class BatchIdsDto {
  @IsArray()
  ids: number[]
}

@Controller('admin/product')
export class ProductController {
  constructor(private readonly svc: ProductService) {}

  @Get()
  list(@Query() q: ProductQueryDto) {
    return this.svc.search(q)
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.svc.findById(id)
  }

  @Post()
  create(@Body() dto: ProductDto) {
    return this.svc.create(dto)
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: ProductDto) {
    return this.svc.update(id, dto)
  }

  @Patch(':id/toggle-listing')
  toggleListing(@Param('id', ParseIntPipe) id: number) {
    return this.svc.toggleListing(id)
  }

  @Patch(':id/toggle-retail')
  toggleRetail(@Param('id', ParseIntPipe) id: number) {
    return this.svc.toggleRetail(id)
  }

  @Patch(':id/toggle-wholesale')
  toggleWholesale(@Param('id', ParseIntPipe) id: number) {
    return this.svc.toggleWholesale(id)
  }

  @Post('batch-remove')
  batchRemove(@Body() dto: BatchIdsDto) {
    return this.svc.batchRemove(dto.ids)
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.svc.remove(id)
  }
}
