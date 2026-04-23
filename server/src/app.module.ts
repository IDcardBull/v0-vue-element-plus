import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_GUARD } from '@nestjs/core'
import { PrismaModule } from './common/prisma.module'
import { JwtAuthGuard } from './common/guards/jwt-auth.guard'
import { AuthModule } from './modules/auth/auth.module'
import { AdminModule } from './modules/admin/admin.module'
import { RoleModule } from './modules/role/role.module'
import { LogModule } from './modules/log/log.module'
import { CategoryModule } from './modules/category/category.module'
import { BrandModule } from './modules/brand/brand.module'
import { ProductModule } from './modules/product/product.module'
import { SkuModule } from './modules/sku/sku.module'
import { PriceTierModule } from './modules/price-tier/price-tier.module'
import { InventoryModule } from './modules/inventory/inventory.module'
import { OrderModule } from './modules/order/order.module'
import { UserModule } from './modules/user/user.module'
import { DistributorModule } from './modules/distributor/distributor.module'
import { ClientAuthModule } from './modules/client-auth/client-auth.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    AdminModule,
    RoleModule,
    LogModule,
    CategoryModule,
    BrandModule,
    ProductModule,
    SkuModule,
    PriceTierModule,
    InventoryModule,
    OrderModule,
    UserModule,
    DistributorModule,
    ClientAuthModule,
  ],
  providers: [
    // 默认所有路由需要 JWT，接口上加 @Public() 可放行
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
