import { HttpModule } from '@nestjs/axios'
import { forwardRef, Module } from '@nestjs/common'
import { Kuaidi100Service } from './kuaidi100.service'
import { LogisticsWebhookController } from './logistics-webhook.controller'
import { OrderModule } from '../order/order.module'

@Module({
  // OrderModule 反向注入 OrderService 用于 webhook → 订单状态机推进
  // 由于 OrderModule 也 import LogisticsModule，必须用 forwardRef 解循环依赖
  imports: [HttpModule, forwardRef(() => OrderModule)],
  controllers: [LogisticsWebhookController],
  providers: [Kuaidi100Service],
  exports: [Kuaidi100Service],
})
export class LogisticsModule {}
