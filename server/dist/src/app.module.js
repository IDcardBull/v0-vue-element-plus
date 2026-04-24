"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const core_1 = require("@nestjs/core");
const prisma_module_1 = require("./common/prisma.module");
const jwt_auth_guard_1 = require("./common/guards/jwt-auth.guard");
const auth_module_1 = require("./modules/auth/auth.module");
const account_module_1 = require("./modules/account/account.module");
const role_module_1 = require("./modules/role/role.module");
const log_module_1 = require("./modules/log/log.module");
const dashboard_module_1 = require("./modules/dashboard/dashboard.module");
const category_module_1 = require("./modules/category/category.module");
const brand_module_1 = require("./modules/brand/brand.module");
const product_module_1 = require("./modules/product/product.module");
const sku_module_1 = require("./modules/sku/sku.module");
const price_tier_module_1 = require("./modules/price-tier/price-tier.module");
const inventory_module_1 = require("./modules/inventory/inventory.module");
const order_module_1 = require("./modules/order/order.module");
const user_module_1 = require("./modules/user/user.module");
const client_auth_module_1 = require("./modules/client-auth/client-auth.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({ isGlobal: true }),
            prisma_module_1.PrismaModule,
            log_module_1.LogModule,
            auth_module_1.AuthModule,
            account_module_1.AccountModule,
            role_module_1.RoleModule,
            dashboard_module_1.DashboardModule,
            category_module_1.CategoryModule,
            brand_module_1.BrandModule,
            product_module_1.ProductModule,
            sku_module_1.SkuModule,
            price_tier_module_1.PriceTierModule,
            inventory_module_1.InventoryModule,
            order_module_1.OrderModule,
            user_module_1.UserModule,
            client_auth_module_1.ClientAuthModule,
        ],
        providers: [
            // 默认所有路由需要 JWT；接口上用 @Public() 放行
            { provide: core_1.APP_GUARD, useClass: jwt_auth_guard_1.JwtAuthGuard },
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map