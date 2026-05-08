import { Module } from '@nestjs/common'
import { ProductModule } from '../product/product.module'
import { CategoryModule } from '../category/category.module'
import { BrandModule } from '../brand/brand.module'
import { OrderModule } from '../order/order.module'

import { ClientCatalogController } from './client-catalog.controller'
import { ClientUserController } from './client-user.controller'
import { ClientAddressController } from './client-address.controller'
import { ClientAddressService } from './client-address.service'
import { ClientOrderController, ClientOrderCompatController } from './client-order.controller'
import { ClientPayController } from './client-pay.controller'
import { WechatPayNotifyController } from './wechat-pay-notify.controller'
import { WechatPayService } from './wechat-pay.service'

/**
 * 小程序端业务聚合模块
 * 所有 /client/* 路由（除 /client/auth/* 由 ClientAuthModule 提供）都在这里
 */
@Module({
  imports: [ProductModule, CategoryModule, BrandModule, OrderModule],
  controllers: [
    ClientCatalogController,
    ClientUserController,
    ClientAddressController,
    ClientOrderController,
    ClientOrderCompatController,
    ClientPayController,
    WechatPayNotifyController,
  ],
  providers: [ClientAddressService, WechatPayService],
  // 导出 WechatPayService 给 ClientAuthModule 使用（多端 AppID 登录）
  exports: [WechatPayService],
})
export class ClientModule {}
