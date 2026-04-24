"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClientAuthController = void 0;
const common_1 = require("@nestjs/common");
const class_validator_1 = require("class-validator");
const client_auth_service_1 = require("./client-auth.service");
const public_decorator_1 = require("../../common/decorators/public.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
class WxLoginDto {
}
__decorate([
    (0, class_validator_1.IsNotEmpty)({ message: 'code 不能为空' }),
    __metadata("design:type", String)
], WxLoginDto.prototype, "code", void 0);
class PhoneLoginDto {
}
__decorate([
    (0, class_validator_1.IsNotEmpty)({ message: '手机号不能为空' }),
    __metadata("design:type", String)
], PhoneLoginDto.prototype, "phone", void 0);
__decorate([
    (0, class_validator_1.IsNotEmpty)({ message: '验证码不能为空' }),
    __metadata("design:type", String)
], PhoneLoginDto.prototype, "code", void 0);
class BindPhoneDto {
}
__decorate([
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], BindPhoneDto.prototype, "phone", void 0);
let ClientAuthController = class ClientAuthController {
    constructor(svc) {
        this.svc = svc;
    }
    miniLogin(dto) {
        return this.svc.miniLogin(dto.code);
    }
    phoneLogin(dto) {
        return this.svc.phoneLogin(dto.phone, dto.code);
    }
    bindPhone(user, dto) {
        return this.svc.bindPhone(user.sub, dto.phone);
    }
};
exports.ClientAuthController = ClientAuthController;
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Post)('mini-login'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [WxLoginDto]),
    __metadata("design:returntype", void 0)
], ClientAuthController.prototype, "miniLogin", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Post)('phone-login'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [PhoneLoginDto]),
    __metadata("design:returntype", void 0)
], ClientAuthController.prototype, "phoneLogin", null);
__decorate([
    (0, common_1.Post)('bind-phone'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, BindPhoneDto]),
    __metadata("design:returntype", void 0)
], ClientAuthController.prototype, "bindPhone", null);
exports.ClientAuthController = ClientAuthController = __decorate([
    (0, common_1.Controller)('client/auth'),
    __metadata("design:paramtypes", [client_auth_service_1.ClientAuthService])
], ClientAuthController);
//# sourceMappingURL=client-auth.controller.js.map