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
exports.BannerAdminController = void 0;
const common_1 = require("@nestjs/common");
const banner_service_1 = require("./banner.service");
/**
 * PC 后台 - 首页轮播图维护
 * 路径与前端 src/api/home.ts 完全对齐：/api/home/banners
 * 全局有 JWT Guard，未加 @Public，需要登录。
 */
let BannerAdminController = class BannerAdminController {
    constructor(svc) {
        this.svc = svc;
    }
    list() {
        return this.svc.listAll();
    }
    save(body) {
        const list = Array.isArray(body) ? body : Array.isArray(body?.list) ? body.list : [];
        return this.svc.replaceAll(list);
    }
};
exports.BannerAdminController = BannerAdminController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], BannerAdminController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], BannerAdminController.prototype, "save", null);
exports.BannerAdminController = BannerAdminController = __decorate([
    (0, common_1.Controller)('home/banners'),
    __metadata("design:paramtypes", [banner_service_1.BannerService])
], BannerAdminController);
//# sourceMappingURL=banner-admin.controller.js.map