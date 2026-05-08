import { HttpModule } from '@nestjs/axios'
import { Module } from '@nestjs/common'
import { Kuaidi100Service } from './kuaidi100.service'
import { LogisticsWebhookController } from './logistics-webhook.controller'

@Module({
  imports: [HttpModule],
  controllers: [LogisticsWebhookController],
  providers: [Kuaidi100Service],
  exports: [Kuaidi100Service],
})
export class LogisticsModule {}
