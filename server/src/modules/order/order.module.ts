import { forwardRef, Module } from '@nestjs/common'
import { OrderController } from './order.controller'
import { OrderService } from './order.service'
import { InventoryModule } from '../inventory/inventory.module'
import { PriceTierModule } from '../price-tier/price-tier.module'
import { WechatPayService } from '../client/wechat-pay.service'
import { LogisticsModule } from '../logistics/logistics.module'

@Module({
  // LogisticsModule 提供 Kuaidi100Service，反向也要拿 OrderService → 用 forwardRef
  // NotifyModule 已标 @Global，不必 import
  imports: [InventoryModule, PriceTierModule, forwardRef(() => LogisticsModule)],
  controllers: [OrderController],
  providers: [OrderService, WechatPayService],
  exports: [OrderService],
})
export class OrderModule {}
