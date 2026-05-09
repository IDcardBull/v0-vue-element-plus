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
exports.DistributorController = void 0;
const common_1 = require("@nestjs/common");
const distributor_service_1 = require("./distributor.service");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const admin_guard_1 = require("../../common/guards/admin.guard");
let DistributorController = class DistributorController {
    constructor(distributorService) {
        this.distributorService = distributorService;
    }
    list(query) {
        return this.distributorService.findAll(query);
    }
    // 必须放在 :id 之前，否则 'stats' 会被 ParseIntPipe 拦下
    stats() {
        return this.distributorService.getStats();
    }
    detail(id) {
        return this.distributorService.findById(id);
    }
    update(id, body) {
        return this.distributorService.update(id, body);
    }
    /** 审核接口：前端传 { pass: boolean, remark?: string } */
    audit(id, body, req) {
        const user = req.user || {};
        const operatorId = Number(user.id || user.adminId || 0);
        return this.distributorService.audit(id, !!body.pass, body.remark, operatorId);
    }
};
exports.DistributorController = DistributorController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], DistributorController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('stats'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], DistributorController.prototype, "stats", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], DistributorController.prototype, "detail", null);
__decorate([
    (0, common_1.Patch)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], DistributorController.prototype, "update", null);
__decorate([
    (0, common_1.Post)(':id/audit'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object, Object]),
    __metadata("design:returntype", void 0)
], DistributorController.prototype, "audit", null);
exports.DistributorController = DistributorController = __decorate([
    (0, common_1.Controller)('admin/distributors'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, admin_guard_1.AdminGuard),
    __metadata("design:paramtypes", [distributor_service_1.DistributorService])
], DistributorController);
//# sourceMappingURL=distributor.controller.js.map