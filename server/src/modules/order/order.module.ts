import { Module } from '@nestjs/common'
import { OrderController } from './order.controller'
import { OrderService } from './order.service'
import { InventoryModule } from '../inventory/inventory.module'
import { PriceTierModule } from '../price-tier/price-tier.module'
import { WechatPayService } from '../client/wechat-pay.service'

@Module({
  imports: [InventoryModule, PriceTierModule],
  controllers: [OrderController],
  providers: [OrderService, WechatPayService],
  exports: [OrderService],
})
export class OrderModule {}
