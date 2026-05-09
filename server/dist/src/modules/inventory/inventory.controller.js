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
exports.InventoryController = void 0;
const common_1 = require("@nestjs/common");
const class_validator_1 = require("class-validator");
const inventory_service_1 = require("./inventory.service");
const pagination_dto_1 = require("../../common/dto/pagination.dto");
class StockQueryDto extends pagination_dto_1.PaginationDto {
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], StockQueryDto.prototype, "keyword", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], StockQueryDto.prototype, "warehouseId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], StockQueryDto.prototype, "categoryId", void 0);
/**
 * 简化版（v2，2026-05）库存接口：
 * - GET /admin/inventory/warehouses 仓库列表
 * - GET /admin/inventory/stocks     SKU + 数量分页
 * 已下线：op / stock-in / stock-out / adjust / records / warnings
 */
let InventoryController = class InventoryController {
    constructor(svc) {
        this.svc = svc;
    }
    warehouses() {
        return this.svc.warehouses();
    }
    stocks(q) {
        return this.svc.stockList(q);
    }
};
exports.InventoryController = InventoryController;
__decorate([
    (0, common_1.Get)('warehouses'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], InventoryController.prototype, "warehouses", null);
__decorate([
    (0, common_1.Get)('stocks'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [StockQueryDto]),
    __metadata("design:returntype", void 0)
], InventoryController.prototype, "stocks", null);
exports.InventoryController = InventoryController = __decorate([
    (0, common_1.Controller)('admin/inventory'),
    __metadata("design:paramtypes", [inventory_service_1.InventoryService])
], InventoryController);
//# sourceMappingURL=inventory.controller.js.map