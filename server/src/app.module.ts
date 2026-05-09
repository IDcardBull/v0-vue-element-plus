import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_GUARD } from '@nestjs/core'
import { PrismaModule } from './common/prisma.module'
import { JwtAuthGuard } from './common/guards/jwt-auth.guard'
import { AuthModule } from './modules/auth/auth.module'
import { AccountModule } from './modules/account/account.module'
import { RoleModule } from './modules/role/role.module'
import { LogModule } from './modules/log/log.module'
import { DashboardModule } from './modules/dashboard/dashboard.module'
import { CategoryModule } from './modules/category/category.module'
import { ProductModule } from './modules/product/product.module'
import { SkuModule } from './modules/sku/sku.module'
import { PriceTierModule } from './modules/price-tier/price-tier.module'
import { InventoryModule } from './modules/inventory/inventory.module'
import { OrderModule } from './modules/order/order.module'
import { UserModule } from './modules/user/user.module'
import { ClientAuthModule } from './modules/client-auth/client-auth.module'
import { ClientModule } from './modules/client/client.module'
import { UploadModule } from './modules/upload/upload.module'
import { DictModule } from './modules/dict/dict.module'
import { LogisticsModule } from './modules/logistics/logistics.module'
import { NotifyModule } from './modules/notify/notify.module'
import { CustomerModule } from './modules/customer/customer.module'
import { DistributorModule } from './modules/distributor/distributor.module'
import { BannerModule } from './modules/banner/banner.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    LogModule,
    AuthModule,
    AccountModule,
    RoleModule,
    DashboardModule,
    CategoryModule,
    ProductModule,
    SkuModule,
    PriceTierModule,
    InventoryModule,
    OrderModule,
    UserModule,
    ClientAuthModule,
    ClientModule,
    UploadModule,
    DictModule,
    LogisticsModule,
    NotifyModule,
    CustomerModule,
    DistributorModule,
    BannerModule,
  ],
  providers: [
    // 默认所有路由需要 JWT；接口上用 @Public() 放行
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
