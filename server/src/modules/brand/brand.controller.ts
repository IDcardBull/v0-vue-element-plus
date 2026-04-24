import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Put, Query } from '@nestjs/common'
import { IsNotEmpty, IsOptional } from 'class-validator'
import { BrandService } from './brand.service'
import { Public } from '@/common/decorators/public.decorator'
import { PaginationDto } from '@/common/dto/pagination.dto'

class BrandDto {
  @IsNotEmpty({ message: '品牌编码必填' })
  code: string

  @IsNotEmpty({ message: '品牌名称必填' })
  name: string

  @IsOptional() logo?: string
  @IsOptional() country?: string
  @IsOptional() origin?: string
  @IsOptional() story?: string
  @IsOptional() sort?: number
  @IsOptional() status?: number
}

class BrandQueryDto extends PaginationDto {
  @IsOptional() keyword?: string
  @IsOptional() status?: number
}

@Controller('admin/brand')
export class BrandController {
  constructor(private readonly svc: BrandService) {}

  @Get()
  list(@Query() q: BrandQueryDto) {
    return this.svc.search(q.keyword, q.status, q.page, q.pageSize)
  }

  @Public()
  @Get('all')
  all() {
    return this.svc.findAll()
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.svc.findById(id)
  }

  @Post()
  create(@Body() dto: BrandDto) {
    return this.svc.create(dto)
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: BrandDto) {
    return this.svc.update(id, dto)
  }

  @Patch(':id/toggle')
  toggle(@Param('id', ParseIntPipe) id: number) {
    return this.svc.toggleStatus(id)
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.svc.remove(id)
  }
}
