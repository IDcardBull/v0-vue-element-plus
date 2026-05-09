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
exports.SkuController = void 0;
const common_1 = require("@nestjs/common");
const class_validator_1 = require("class-validator");
const sku_service_1 = require("./sku.service");
class UpdateStockDto {
}
__decorate([
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], UpdateStockDto.prototype, "stock", void 0);
class UpdatePriceDto {
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], UpdatePriceDto.prototype, "retailPrice", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], UpdatePriceDto.prototype, "memberPrice", void 0);
let SkuController = class SkuController {
    constructor(svc) {
        this.svc = svc;
    }
    listByProduct(pid) {
        return this.svc.findByProduct(pid);
    }
    findOne(id) {
        return this.svc.findById(id);
    }
    updateStock(id, dto) {
        return this.svc.updateStock(id, dto.stock);
    }
    /**
     * 修改 SKU 价格（零售/会员价）
     * 批发阶梯价由 priceTiers 表管理，本接口只动 SKU 自身的 retailPrice/memberPrice
     */
    updatePrice(id, dto) {
        return this.svc.updatePrice(id, dto);
    }
};
exports.SkuController = SkuController;
__decorate([
    (0, common_1.Get)('by-product/:productId'),
    __param(0, (0, common_1.Param)('productId', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], SkuController.prototype, "listByProduct", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], SkuController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id/stock'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, UpdateStockDto]),
    __metadata("design:returntype", void 0)
], SkuController.prototype, "updateStock", null);
__decorate([
    (0, common_1.Patch)(':id/price'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, UpdatePriceDto]),
    __metadata("design:returntype", void 0)
], SkuController.prototype, "updatePrice", null);
exports.SkuController = SkuController = __decorate([
    (0, common_1.Controller)('admin/sku'),
    __metadata("design:paramtypes", [sku_service_1.SkuService])
], SkuController);
//# sourceMappingURL=sku.controller.js.map