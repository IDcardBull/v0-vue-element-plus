import { HttpModule } from '@nestjs/axios'
import { Global, Module } from '@nestjs/common'
import { WorkWxService } from './work-wx.service'

/**
 * 全局通知模块。
 * 标 @Global 是为了让 OrderService / WechatPayNotifyController 等任意业务侧
 * 直接 inject WorkWxService，不必每个模块都把 NotifyModule 写进 imports。
 */
@Global()
@Module({
  imports: [HttpModule],
  providers: [WorkWxService],
  exports: [WorkWxService],
})
export class NotifyModule {}
