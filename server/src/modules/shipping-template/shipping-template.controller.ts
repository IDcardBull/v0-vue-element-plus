import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common'
import { ShippingTemplateService, type ShippingTemplateInput } from './shipping-template.service'

/**
 * PC 后台 - 运费模板维护
 * 路径前缀 /api/admin/shipping-templates，全局 JWT 守卫保护，需登录。
 */
@Controller('admin/shipping-templates')
export class ShippingTemplateController {
  constructor(private readonly svc: ShippingTemplateService) {}

  @Get()
  list() {
    return this.svc.list()
  }

  @Get(':id')
  detail(@Param('id', ParseIntPipe) id: number) {
    return this.svc.detail(id)
  }

  @Post()
  create(@Body() body: ShippingTemplateInput) {
    return this.svc.create(body)
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() body: ShippingTemplateInput) {
    return this.svc.update(id, body)
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.svc.remove(id)
  }
}
