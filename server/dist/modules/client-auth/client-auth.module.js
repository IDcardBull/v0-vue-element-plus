"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClientAuthModule = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const config_1 = require("@nestjs/config");
const client_auth_controller_1 = require("./client-auth.controller");
const client_auth_service_1 = require("./client-auth.service");
const client_module_1 = require("../client/client.module");
let ClientAuthModule = class ClientAuthModule {
};
exports.ClientAuthModule = ClientAuthModule;
exports.ClientAuthModule = ClientAuthModule = __decorate([
    (0, common_1.Module)({
        imports: [
            // 引入 ClientModule 拿 WechatPayService（按 channel 解析 AppID/Secret）
            client_module_1.ClientModule,
            // 注入 JwtService（与管理端 AuthModule 共用同一 JWT_SECRET，保证三端 token 互通）
            jwt_1.JwtModule.registerAsync({
                inject: [config_1.ConfigService],
                useFactory: (config) => ({
                    secret: config.get('JWT_SECRET'),
                    signOptions: { expiresIn: config.get('JWT_EXPIRES_IN') || '7d' },
                }),
            }),
        ],
        controllers: [client_auth_controller_1.ClientAuthController],
        providers: [client_auth_service_1.ClientAuthService],
        exports: [client_auth_service_1.ClientAuthService],
    })
], ClientAuthModule);
//# sourceMappingURL=client-auth.module.js.map