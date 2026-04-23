import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Put } from '@nestjs/common'
import { IsInt, IsNotEmpty, IsOptional } from 'class-validator'
import { CategoryService } from './category.service'
import { Public } from '@/common/decorators/public.decorator'

class CategoryDto {
  @IsNotEmpty({ message: '分类编码必填' })
  code: string

  @IsNotEmpty({ message: '分类名称必填' })
  name: string

  @IsOptional()
  @IsInt()
  parentId?: number

  @IsOptional() sort?: number
  @IsOptional() icon?: string
  @IsOptional() description?: string
  @IsOptional() status?: number
}

@Controller('admin/category')
export class CategoryController {
  constructor(private readonly svc: CategoryService) {}

  // 树形接口允许客户端（小程序）也能调用
  @Public()
  @Get('tree')
  tree() {
    return this.svc.tree()
  }

  @Get()
  findAll() {
    return this.svc.findAll()
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.svc.findById(id)
  }

  @Post()
  create(@Body() dto: CategoryDto) {
    return this.svc.create(dto)
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: CategoryDto) {
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
