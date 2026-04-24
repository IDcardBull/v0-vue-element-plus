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

@Controller('admin/brands')
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

  // 前端既可能用 PUT 全量更新，也可能用 PATCH 部分更新，两者都支持
  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: BrandDto) {
    return this.svc.update(id, dto)
  }

  @Patch(':id')
  patch(@Param('id', ParseIntPipe) id: number, @Body() dto: BrandDto) {
    return this.svc.update(id, dto)
  }

  // 前端调用 PATCH /admin/brands/:id/status { status: 'active' | 'disabled' }
  @Patch(':id/status')
  toggle(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { status?: 'active' | 'disabled' | number },
  ) {
    // 兼容字符串/数字两种写法：'active' -> 1, 'disabled' -> 0
    let next: number | undefined
    if (body?.status !== undefined) {
      if (typeof body.status === 'number') next = body.status
      else next = body.status === 'active' ? 1 : 0
    }
    return this.svc.toggleStatus(id, next)
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.svc.remove(id)
  }
}
