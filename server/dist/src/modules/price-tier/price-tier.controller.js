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
exports.PriceTierController = void 0;
const common_1 = require("@nestjs/common");
const class_validator_1 = require("class-validator");
const price_tier_service_1 = require("./price-tier.service");
class ReplaceTiersDto {
}
__decorate([
    (0, class_validator_1.IsArray)(),
    __metadata("design:type", Array)
], ReplaceTiersDto.prototype, "tiers", void 0);
let PriceTierController = class PriceTierController {
    constructor(svc) {
        this.svc = svc;
    }
    list(skuId) {
        return this.svc.listBySku(skuId);
    }
    replace(skuId, dto) {
        return this.svc.replace(skuId, dto.tiers);
    }
    match(skuId, qty) {
        return this.svc.matchPrice(skuId, qty);
    }
};
exports.PriceTierController = PriceTierController;
__decorate([
    (0, common_1.Get)('by-sku/:skuId'),
    __param(0, (0, common_1.Param)('skuId', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], PriceTierController.prototype, "list", null);
__decorate([
    (0, common_1.Put)('by-sku/:skuId'),
    __param(0, (0, common_1.Param)('skuId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, ReplaceTiersDto]),
    __metadata("design:returntype", void 0)
], PriceTierController.prototype, "replace", null);
__decorate([
    (0, common_1.Get)('match'),
    __param(0, (0, common_1.Query)('skuId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Query)('qty', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number]),
    __metadata("design:returntype", void 0)
], PriceTierController.prototype, "match", null);
exports.PriceTierController = PriceTierController = __decorate([
    (0, common_1.Controller)('admin/price-tier'),
    __metadata("design:paramtypes", [price_tier_service_1.PriceTierService])
], PriceTierController);
//# sourceMappingURL=price-tier.controller.js.map