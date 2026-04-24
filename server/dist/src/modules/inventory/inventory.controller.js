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
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const pagination_dto_1 = require("../../common/dto/pagination.dto");
class StockOpDto {
}
__decorate([
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], StockOpDto.prototype, "type", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], StockOpDto.prototype, "skuId", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], StockOpDto.prototype, "warehouseId", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], StockOpDto.prototype, "qty", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], StockOpDto.prototype, "orderNo", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], StockOpDto.prototype, "remark", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], StockOpDto.prototype, "relatedId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], StockOpDto.prototype, "relatedType", void 0);
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
class RecordQueryDto extends pagination_dto_1.PaginationDto {
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], RecordQueryDto.prototype, "type", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], RecordQueryDto.prototype, "keyword", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], RecordQueryDto.prototype, "warehouseId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], RecordQueryDto.prototype, "dateFrom", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], RecordQueryDto.prototype, "dateTo", void 0);
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
    warnings(level) {
        return this.svc.warnings(level);
    }
    records(q) {
        return this.svc.recordList(q);
    }
    async op(dto, user) {
        const orderNo = dto.orderNo ||
            `${dto.type.toUpperCase()}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        return this.svc.stockOp({
            orderNo,
            type: dto.type,
            skuId: dto.skuId,
            warehouseId: dto.warehouseId,
            qty: dto.qty,
            operator: user.username,
            remark: dto.remark,
            relatedId: dto.relatedId,
            relatedType: dto.relatedType,
        });
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
__decorate([
    (0, common_1.Get)('warnings'),
    __param(0, (0, common_1.Query)('level')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], InventoryController.prototype, "warnings", null);
__decorate([
    (0, common_1.Get)('records'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [RecordQueryDto]),
    __metadata("design:returntype", void 0)
], InventoryController.prototype, "records", null);
__decorate([
    (0, common_1.Post)('op'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [StockOpDto, Object]),
    __metadata("design:returntype", Promise)
], InventoryController.prototype, "op", null);
exports.InventoryController = InventoryController = __decorate([
    (0, common_1.Controller)('admin/inventory'),
    __metadata("design:paramtypes", [inventory_service_1.InventoryService])
], InventoryController);
//# sourceMappingURL=inventory.controller.js.map