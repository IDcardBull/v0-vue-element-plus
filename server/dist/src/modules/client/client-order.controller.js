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
exports.ClientOrderCompatController = exports.ClientOrderController = void 0;
const common_1 = require("@nestjs/common");
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const order_service_1 = require("../order/order.service");
const prisma_service_1 = require("../../common/prisma.service");
const shipping_template_calc_1 = require("../shipping-template/shipping-template.calc");
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
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateOrderDto.prototype, "channel", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateOrderDto.prototype, "source", void 0);
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
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateOrderDto.prototype, "payMethod", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Boolean)
], CreateOrderDto.prototype, "useCredit", void 0);
class UpdateAddressDto {
}
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], UpdateAddressDto.prototype, "addressId", void 0);
class PreviewOrderDto {
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PreviewOrderDto.prototype, "channel", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1, { message: '商品不能为空' }),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => OrderItemDto),
    __metadata("design:type", Array)
], PreviewOrderDto.prototype, "items", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], PreviewOrderDto.prototype, "addressId", void 0);
let ClientOrderController = class ClientOrderController {
    constructor(orderSvc, prisma) {
        this.orderSvc = orderSvc;
        this.prisma = prisma;
    }
    ensureClient(user) {
        if (user.userType !== 'client')
            throw new common_1.ForbiddenException('仅小程序用户可下单');
    }
    /**
     * 结算页运费试算 —— 不落库，纯计算
     * 输入：商品列表 + 收货地址 id（可选）
     * 输出：商品小计、运费、应付、按模板分组的运费明细
     * 与 createOrder 共用同一份 calcShippingByTemplate，保证下单时金额一致
     */
    async preview(user, dto) {
        this.ensureClient(user);
        if (!dto.items?.length)
            throw new common_1.BadRequestException('商品不能为空');
        // 取地址省份（没传地址 → 用默认地址；都没有 → null，按全国默认规则）
        let province = null;
        if (dto.addressId) {
            const addr = await this.prisma.address.findFirst({
                where: { id: Number(dto.addressId), userId: user.sub },
            });
            if (!addr)
                throw new common_1.BadRequestException('地址不存在');
            province = addr.province;
        }
        else {
            const def = await this.prisma.address.findFirst({
                where: { userId: user.sub, isDefault: true },
            });
            province = def?.province || null;
        }
        const channel = dto.channel === 'wholesale' ? 'wholesale' : 'retail';
        let totalAmount = 0;
        let legacyMaxFee = 0;
        let legacyAllFree = true;
        let legacyHasItem = false;
        const legacyProductNames = []; // 没挂模板的商品名
        const templateGroups = new Map();
        for (const it of dto.items) {
            const sku = await this.prisma.sku.findUnique({
                where: { id: Number(it.skuId) },
                include: { product: { include: { shippingTemplate: true } } },
            });
            if (!sku)
                throw new common_1.BadRequestException(`SKU ${it.skuId} 不存在`);
            const product = sku.product;
            const qty = Math.max(1, Number(it.qty) || 1);
            // 价格：preview 与 createOrder 同源 —— SKU 表里只有 retailPrice / memberPrice，
            // 批发档位价在 PriceTier 表。preview 不做 MOQ 强校验（让前端能展示总价），
            // 但价格本身要尽量贴近真实下单价。
            let unitPrice = Number(sku.retailPrice);
            if (channel === 'wholesale') {
                // 取该 SKU 已配置的最高阶梯价对应价格（按 minQty 升序找命中档）
                const tiers = await this.prisma.priceTier.findMany({
                    where: { skuId: sku.id },
                    orderBy: { minQty: 'asc' },
                });
                if (tiers.length) {
                    let matched = null;
                    for (const t of tiers) {
                        if (qty >= Number(t.minQty))
                            matched = Number(t.price);
                    }
                    // qty 小于最低档位也用最低档位价做预估，避免 preview 显示混乱
                    unitPrice = matched != null ? matched : Number(tiers[0].price);
                }
            }
            else if (sku.memberPrice != null) {
                // 零售：登录用户若有会员价用会员价（保持和 createOrder 类似的优先级）
                unitPrice = Number(sku.memberPrice);
            }
            const subtotal = unitPrice * qty;
            totalAmount += subtotal;
            if (product.shippingTemplate) {
                const tpl = product.shippingTemplate;
                let group = templateGroups.get(tpl.id);
                if (!group) {
                    group = {
                        template: tpl,
                        items: [],
                        templateName: product.shippingTemplate.name,
                    };
                    templateGroups.set(tpl.id, group);
                }
                group.items.push({
                    qty,
                    weight: sku.weight == null ? 0 : Number(sku.weight),
                    subtotal,
                });
            }
            else {
                legacyHasItem = true;
                legacyProductNames.push(product.name);
                const free = product.freeShipping === true;
                const fee = Number(product.shippingFee || 0);
                if (!free) {
                    legacyAllFree = false;
                    if (fee > legacyMaxFee)
                        legacyMaxFee = fee;
                }
            }
        }
        /**
         * breakdown 给前端展示：每条都附带 reason，方便定位"为啥是 0 元"
         *   - 'template'         按模板算出的运费（>0 也回传 reason='template'）
         *   - 'free_shipping'    模板满额包邮命中
         *   - 'no_first_rule'    模板默认规则 firstAmount/firstPrice=0
         *   - 'legacy'           商品未挂模板，走老 freeShipping/shippingFee
         *   - 'legacy_all_free'  商品未挂模板且全部 freeShipping=true
         */
        const breakdown = [];
        let templateFreight = 0;
        for (const [tplId, { template, items, templateName }] of templateGroups.entries()) {
            const f = (0, shipping_template_calc_1.calcShippingByTemplate)(template, items, province);
            templateFreight += f;
            let reason = 'template';
            if (f === 0) {
                const def = template.defaultRule || {};
                const firstAmount = Number(def.firstAmount) || 0;
                const firstPrice = Number(def.firstPrice) || 0;
                if (template.freeShippingEnabled)
                    reason = 'free_shipping';
                else if (firstAmount <= 0 || firstPrice <= 0)
                    reason = 'no_first_rule';
            }
            breakdown.push({ templateId: tplId, templateName, freight: f, reason });
        }
        const legacyFreight = legacyHasItem ? (legacyAllFree ? 0 : legacyMaxFee) : 0;
        if (legacyHasItem) {
            breakdown.push({
                templateId: null,
                templateName: legacyProductNames.length
                    ? `未配模板：${legacyProductNames.slice(0, 3).join('、')}${legacyProductNames.length > 3 ? '…' : ''}`
                    : '默认运费',
                freight: legacyFreight,
                reason: legacyAllFree ? 'legacy_all_free' : 'legacy',
            });
        }
        const freight = Math.round((templateFreight + legacyFreight) * 100) / 100;
        const payAmount = Math.round((totalAmount + freight) * 100) / 100;
        return {
            totalAmount: Math.round(totalAmount * 100) / 100,
            freight,
            payAmount,
            province, // 让前端知道按哪个省算的
            breakdown, // 给前端可选展示「按模板分组的运费」+ 每段为何是 0
        };
    }
    /**
     * 下单（零售渠道，未支付状态）
     * 前端接收订单号后，再调用 POST /client/orders/:id/pay 拿微信支付参数
     */
    async create(user, dto) {
        this.ensureClient(user);
        const channel = dto.channel === 'wholesale' ? 'wholesale' : 'retail';
        const source = dto.source || (channel === 'wholesale' ? 'miniprogram_b' : 'miniprogram');
        return this.orderSvc.createOrder({
            userId: user.sub,
            channel,
            source,
            items: dto.items,
            addressId: dto.addressId,
            remark: dto.remark,
            payMethod: dto.payMethod || (channel === 'wholesale' ? 'offline' : 'wechat'),
            useCredit: !!dto.useCredit,
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
    async logistics(user, id) {
        this.ensureClient(user);
        const order = await this.orderSvc.findById(id);
        if (order.userId !== user.sub)
            throw new common_1.NotFoundException('订单不存在');
        return this.orderSvc.getLogistics(id);
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
    /** 更新收货地址（主路径） */
    async updateAddress(user, id, dto) {
        this.ensureClient(user);
        return this.orderSvc.updateAddress(id, user.sub, Number(dto.addressId));
    }
    /** 更新收货地址（兼容回退路径） */
    async updateAddressFallback(user, body) {
        this.ensureClient(user);
        return this.orderSvc.updateAddress(Number(body.id), user.sub, Number(body.addressId));
    }
};
exports.ClientOrderController = ClientOrderController;
__decorate([
    (0, common_1.Post)('preview'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, PreviewOrderDto]),
    __metadata("design:returntype", Promise)
], ClientOrderController.prototype, "preview", null);
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
    (0, common_1.Get)(':id/logistics'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], ClientOrderController.prototype, "logistics", null);
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
__decorate([
    (0, common_1.Patch)(':id/address'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, UpdateAddressDto]),
    __metadata("design:returntype", Promise)
], ClientOrderController.prototype, "updateAddress", null);
__decorate([
    (0, common_1.Post)('/update-address'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ClientOrderController.prototype, "updateAddressFallback", null);
exports.ClientOrderController = ClientOrderController = __decorate([
    (0, common_1.Controller)('client/orders'),
    __metadata("design:paramtypes", [order_service_1.OrderService,
        prisma_service_1.PrismaService])
], ClientOrderController);
let ClientOrderCompatController = class ClientOrderCompatController {
    constructor(orderSvc) {
        this.orderSvc = orderSvc;
    }
    async updateAddressFallback(user, body) {
        if (user.userType !== 'client')
            throw new common_1.ForbiddenException('仅小程序用户可下单');
        return this.orderSvc.updateAddress(Number(body.id), user.sub, Number(body.addressId));
    }
};
exports.ClientOrderCompatController = ClientOrderCompatController;
__decorate([
    (0, common_1.Post)('update-address'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ClientOrderCompatController.prototype, "updateAddressFallback", null);
exports.ClientOrderCompatController = ClientOrderCompatController = __decorate([
    (0, common_1.Controller)('client/order'),
    __metadata("design:paramtypes", [order_service_1.OrderService])
], ClientOrderCompatController);
//# sourceMappingURL=client-order.controller.js.map