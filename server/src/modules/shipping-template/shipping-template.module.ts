import { Module } from '@nestjs/common'
import { ShippingTemplateService } from './shipping-template.service'
import { ShippingTemplateController } from './shipping-template.controller'

@Module({
  controllers: [ShippingTemplateController],
  providers: [ShippingTemplateService],
  exports: [ShippingTemplateService],
})
export class ShippingTemplateModule {}
