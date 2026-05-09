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
Object.defineProperty(exports, "__esModule", { value: true });
exports.BannerClientController = void 0;
const common_1 = require("@nestjs/common");
const public_decorator_1 = require("../../common/decorators/public.decorator");
const banner_service_1 = require("./banner.service");
/**
 * 小程序端 - 首页轮播图（公开读取）
 * B2C miniprogram utils/api.js 已经在调 GET /client/banners
 * 返回：[{ id, title, imageUrl, linkUrl, sort, enabled }]
 */
let BannerClientController = class BannerClientController {
    constructor(svc) {
        this.svc = svc;
    }
    list() {
        return this.svc.listEnabled();
    }
};
exports.BannerClientController = BannerClientController;
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], BannerClientController.prototype, "list", null);
exports.BannerClientController = BannerClientController = __decorate([
    (0, common_1.Controller)('client/banners'),
    __metadata("design:paramtypes", [banner_service_1.BannerService])
], BannerClientController);
//# sourceMappingURL=banner-client.controller.js.map