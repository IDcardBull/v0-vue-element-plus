"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClientModule = void 0;
const common_1 = require("@nestjs/common");
const product_module_1 = require("../product/product.module");
const category_module_1 = require("../category/category.module");
const brand_module_1 = require("../brand/brand.module");
const order_module_1 = require("../order/order.module");
const client_catalog_controller_1 = require("./client-catalog.controller");
const client_user_controller_1 = require("./client-user.controller");
const client_address_controller_1 = require("./client-address.controller");
const client_address_service_1 = require("./client-address.service");
const client_order_controller_1 = require("./client-order.controller");
const client_pay_controller_1 = require("./client-pay.controller");
const wechat_pay_service_1 = require("./wechat-pay.service");
/**
 * 小程序端业务聚合模块
 * 所有 /client/* 路由（除 /client/auth/* 由 ClientAuthModule 提供）都在这里
 */
let ClientModule = class ClientModule {
};
exports.ClientModule = ClientModule;
exports.ClientModule = ClientModule = __decorate([
    (0, common_1.Module)({
        imports: [product_module_1.ProductModule, category_module_1.CategoryModule, brand_module_1.BrandModule, order_module_1.OrderModule],
        controllers: [
            client_catalog_controller_1.ClientCatalogController,
            client_user_controller_1.ClientUserController,
            client_address_controller_1.ClientAddressController,
            client_order_controller_1.ClientOrderController,
            client_pay_controller_1.ClientPayController,
        ],
        providers: [client_address_service_1.ClientAddressService, wechat_pay_service_1.WechatPayService],
    })
], ClientModule);
//# sourceMappingURL=client.module.js.map