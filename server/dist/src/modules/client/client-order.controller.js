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
exports.ClientOrderController = void 0;
const common_1 = require("@nestjs/common");
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const order_service_1 = require("../order/order.service");
class OrderItemDto {
}
__decorate([
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], OrderItemDto.prototype, "skuId", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], OrderItemDto.prototype, "qty", void 0);
class CreateOrderDto {
}
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1, { message: '商品不能为空' }),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => OrderItemDto),
    __metadata("design:type", Array)
], CreateOrderDto.prototype, "items", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], CreateOrderDto.prototype, "addressId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], CreateOrderDto.prototype, "remark", void 0);
let ClientOrderController = class ClientOrderController {
    constructor(orderSvc) {
        this.orderSvc = orderSvc;
    }
    ensureClient(user) {
        if (user.userType !== 'client')
            throw new common_1.ForbiddenException('仅小程序用户可下单');
    }
    /**
     * 下单（零售渠道，未支付状态）
     * 前端接收订单号后，再调用 POST /client/orders/:id/pay 拿微信支付参数
     */
    async create(user, dto) {
        this.ensureClient(user);
        return this.orderSvc.createOrder({
            userId: user.sub,
            channel: 'retail',
            source: 'miniprogram',
            items: dto.items,
            addressId: dto.addressId,
            remark: dto.remark,
            payMethod: 'wechat',
        });
    }
    /**
     * 我的订单列表
     * status: pending_pay | pending_ship | shipped | completed | after_sale | closed | all
     */
    list(user, status, page, pageSize) {
        this.ensureClient(user);
        return this.orderSvc.search({
            userId: user.sub,
            status: status && status !== 'all' ? status : undefined,
            page: Number(page) || 1,
            pageSize: Number(pageSize) || 10,
        });
    }
    /** 订单状态徽标数量（我的订单页 Tab 上的小红点） */
    counts(user) {
        this.ensureClient(user);
        return this.orderSvc.statusCounts({ userId: user.sub });
    }
    async detail(user, id) {
        this.ensureClient(user);
        const order = await this.orderSvc.findById(id);
        if (order.userId !== user.sub)
            throw new common_1.NotFoundException('订单不存在');
        return order;
    }
    /** 用户取消未支付订单 */
    async cancel(user, id, body = {}) {
        this.ensureClient(user);
        const order = await this.orderSvc.findById(id);
        if (order.userId !== user.sub)
            throw new common_1.NotFoundException('订单不存在');
        return this.orderSvc.close(id, body.reason || '用户主动取消');
    }
    /** 用户确认收货 */
    async confirm(user, id) {
        this.ensureClient(user);
        const order = await this.orderSvc.findById(id);
        if (order.userId !== user.sub)
            throw new common_1.NotFoundException('订单不存在');
        return this.orderSvc.complete(id);
    }
};
exports.ClientOrderController = ClientOrderController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, CreateOrderDto]),
    __metadata("design:returntype", Promise)
], ClientOrderController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('status')),
    __param(2, (0, common_1.Query)('page')),
    __param(3, (0, common_1.Query)('pageSize')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", void 0)
], ClientOrderController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('status-counts'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ClientOrderController.prototype, "counts", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], ClientOrderController.prototype, "detail", null);
__decorate([
    (0, common_1.Patch)(':id/cancel'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, Object]),
    __metadata("design:returntype", Promise)
], ClientOrderController.prototype, "cancel", null);
__decorate([
    (0, common_1.Patch)(':id/confirm'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], ClientOrderController.prototype, "confirm", null);
exports.ClientOrderController = ClientOrderController = __decorate([
    (0, common_1.Controller)('client/orders'),
    __metadata("design:paramtypes", [order_service_1.OrderService])
], ClientOrderController);
//# sourceMappingURL=client-order.controller.js.map