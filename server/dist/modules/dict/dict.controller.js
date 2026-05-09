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
exports.DictController = void 0;
const common_1 = require("@nestjs/common");
const class_validator_1 = require("class-validator");
const public_decorator_1 = require("../../common/decorators/public.decorator");
const dict_service_1 = require("./dict.service");
class DictItemDto {
}
__decorate([
    (0, class_validator_1.IsNotEmpty)({ message: '名称必填' }),
    __metadata("design:type", String)
], DictItemDto.prototype, "label", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], DictItemDto.prototype, "value", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], DictItemDto.prototype, "sort", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], DictItemDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], DictItemDto.prototype, "remark", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], DictItemDto.prototype, "typeName", void 0);
let DictController = class DictController {
    constructor(svc) {
        this.svc = svc;
    }
    types() {
        return this.svc.types();
    }
    items(typeCode, includeDisabled) {
        return this.svc.items(typeCode, includeDisabled === 'true');
    }
    createItem(typeCode, dto) {
        return this.svc.createItem(typeCode, dto);
    }
    updateItem(id, dto) {
        return this.svc.updateItem(id, dto);
    }
    toggleItem(id) {
        return this.svc.toggleItem(id);
    }
    removeItem(id) {
        return this.svc.removeItem(id);
    }
};
exports.DictController = DictController;
__decorate([
    (0, common_1.Get)('types'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], DictController.prototype, "types", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)(':typeCode'),
    __param(0, (0, common_1.Param)('typeCode')),
    __param(1, (0, common_1.Query)('includeDisabled')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], DictController.prototype, "items", null);
__decorate([
    (0, common_1.Post)(':typeCode/items'),
    __param(0, (0, common_1.Param)('typeCode')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, DictItemDto]),
    __metadata("design:returntype", void 0)
], DictController.prototype, "createItem", null);
__decorate([
    (0, common_1.Patch)('items/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], DictController.prototype, "updateItem", null);
__decorate([
    (0, common_1.Patch)('items/:id/toggle'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], DictController.prototype, "toggleItem", null);
__decorate([
    (0, common_1.Delete)('items/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], DictController.prototype, "removeItem", null);
exports.DictController = DictController = __decorate([
    (0, common_1.Controller)('admin/dicts'),
    __metadata("design:paramtypes", [dict_service_1.DictService])
], DictController);
//# sourceMappingURL=dict.controller.js.map