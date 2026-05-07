import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common'
import { IsNotEmpty, IsOptional } from 'class-validator'
import { Public } from '@/common/decorators/public.decorator'
import { DictService } from './dict.service'

class DictItemDto {
  @IsNotEmpty({ message: '名称必填' })
  label: string

  @IsOptional()
  value?: string

  @IsOptional()
  sort?: number

  @IsOptional()
  status?: number

  @IsOptional()
  remark?: string

  @IsOptional()
  typeName?: string
}

@Controller('admin/dicts')
export class DictController {
  constructor(private readonly svc: DictService) {}

  @Get('types')
  types() {
    return this.svc.types()
  }

  @Public()
  @Get(':typeCode')
  items(
    @Param('typeCode') typeCode: string,
    @Query('includeDisabled') includeDisabled?: string,
  ) {
    return this.svc.items(typeCode, includeDisabled === 'true')
  }

  @Post(':typeCode/items')
  createItem(@Param('typeCode') typeCode: string, @Body() dto: DictItemDto) {
    return this.svc.createItem(typeCode, dto)
  }

  @Patch('items/:id')
  updateItem(@Param('id', ParseIntPipe) id: number, @Body() dto: Partial<DictItemDto>) {
    return this.svc.updateItem(id, dto)
  }

  @Patch('items/:id/toggle')
  toggleItem(@Param('id', ParseIntPipe) id: number) {
    return this.svc.toggleItem(id)
  }

  @Delete('items/:id')
  removeItem(@Param('id', ParseIntPipe) id: number) {
    return this.svc.removeItem(id)
  }
}
