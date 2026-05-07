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
var OrderService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../common/prisma.service");
const price_tier_service_1 = require("../price-tier/price-tier.service");
const inventory_service_1 = require("../inventory/inventory.service");
const wechat_pay_service_1 = require("../client/wechat-pay.service");
function normalizeOrderChannel(channel) {
    const value = String(channel || '').trim();
    if (!value || value === 'all')
        return undefined;
    if (value === 'retail' || value === 'wholesale' || value === 'live' || value === 'offline')
        return value;
    return undefined;
}
let OrderService = OrderService_1 = class OrderService {
    constructor(prisma, priceTier, inventory, wechatPay) {
        this.prisma = prisma;
        this.priceTier = priceTier;
        this.inventory = inventory;
        this.wechatPay = wechatPay;
        this.logger = new common_1.Logger(OrderService_1.name);
    }
    // -------------------- 查询 --------------------
    async search(q) {
        const page = Number(q.page) || 1;
        const pageSize = Number(q.pageSize) || 20;
        const where = {};
        if (q.orderNo)
            where.orderNo = { contains: q.orderNo };
        const channel = normalizeOrderChannel(q.channel);
        if (channel)
            where.channel = channel;
        if (q.status)
            where.status = q.status;
        if (q.userId)
            where.userId = Number(q.userId);
        if (q.dateFrom || q.dateTo) {
            where.createdAt = {};
            if (q.dateFrom)
                where.createdAt.gte = new Date(q.dateFrom);
            if (q.dateTo)
                where.createdAt.lte = new Date(q.dateTo + 'T23:59:59');
        }
        const [list, total] = await this.prisma.$transaction([
            this.prisma.order.findMany({
                where,
                orderBy: { id: 'desc' },
                skip: (page - 1) * pageSize,
                take: pageSize,
                include: {
                    user: { select: { id: true, nickname: true, phone: true, avatar: true } },
                    address: { select: { receiver: true, phone: true, province: true, city: true, district: true, detail: true } },
                    items: true,
                },
            }),
            this.prisma.order.count({ where }),
        ]);
        return { list, total, page, pageSize };
    }
    async findById(id) {
        const order = await this.prisma.order.findUnique({
            where: { id: BigInt(id) },
            include: {
                user: true,
                address: true,
                items: true,
            },
        });
        if (!order)
            throw new common_1.NotFoundException('订单不存在');
        return order;
    }
    async getLogistics(orderId) {
        const order = await this.findById(orderId);
        return this.wechatPay.queryLogistics({
            logisticsCompany: order.logisticsCompany,
            trackingNo: order.trackingNo,
        });
    }
    async updateAddress(orderId, userId, addressId) {
        const order = await this.findById(orderId);
        if (order.userId !== userId)
            throw new common_1.NotFoundException('订单不存在');
        if (!['pending_pay', 'pending_ship'].includes(order.status)) {
            throw new common_1.BadRequestException('当前订单状态不允许修改地址');
        }
        const addr = await this.prisma.address.findFirst({ where: { id: addressId, userId } });
        if (!addr)
            throw new common_1.BadRequestException('地址不存在');
        return this.prisma.order.update({
            where: { id: BigInt(orderId) },
            data: {
                addressId: addr.id,
                receiverSnapshot: addr,
            },
        });
    }
    /** 订单状态统计，顶部 Tab 徽标用 */
    async statusCounts(filters = {}) {
        const where = {};
        const channel = normalizeOrderChannel(filters.channel);
        if (channel)
            where.channel = channel;
        if (filters.userId)
            where.userId = filters.userId;
        const statuses = [
            'pending_pay', 'pending_ship', 'shipped', 'completed', 'after_sale', 'closed',
        ];
        const result = { all: 0 };
        for (const s of statuses) {
            result[s] = await this.prisma.order.count({ where: { ...where, status: s } });
            result.all += result[s];
        }
        return result;
    }
    // -------------------- 下单 --------------------
    /**
     * 小程序/H5 下单入口。
     * items: [{skuId, qty}]
     * 批发用户会自动匹配阶梯价
     */
    async createOrder(input) {
        if (!input.items?.length)
            throw new common_1.BadRequestException('商品不能为空');
        const user = await this.prisma.user.findUnique({
            where: { id: input.userId },
            include: { distributor: true },
        });
        if (!user)
            throw new common_1.BadRequestException('用户不存在');
        // 1. 拼装订单项 & 计算金额
        const itemRecords = [];
        let totalAmount = 0;
        for (const it of input.items) {
            const sku = await this.prisma.sku.findUnique({
                where: { id: it.skuId },
                include: { product: true },
            });
            if (!sku)
                throw new common_1.BadRequestException(`SKU ${it.skuId} 不存在`);
            let unitPrice = Number(sku.retailPrice);
            if (input.channel === 'wholesale') {
                const tierPrice = await this.priceTier.matchPrice(it.skuId, it.qty);
                if (tierPrice == null)
                    throw new common_1.BadRequestException(`${sku.product.name} 未达到最低起订量`);
                unitPrice = tierPrice;
            }
            else if (user.levelId && sku.memberPrice) {
                unitPrice = Number(sku.memberPrice);
            }
            const subtotal = unitPrice * it.qty;
            totalAmount += subtotal;
            itemRecords.push({
                productId: sku.productId,
                skuId: sku.id,
                productName: sku.product.name,
                skuSpec: JSON.stringify(sku.specs),
                skuImage: sku.image || sku.product.mainImage,
                qty: it.qty,
                unitPrice,
                subtotal,
            });
        }
        // 2. 校验授信（仅批发授信单）
        if (input.useCredit) {
            if (user.role !== 'dealer' || !user.distributor)
                throw new common_1.BadRequestException('仅分销商可使用授信');
            const used = Number(user.distributor.creditUsed);
            const limit = Number(user.distributor.creditLimit);
            if (used + totalAmount > limit)
                throw new common_1.BadRequestException(`授信额度不足：可用 ${limit - used}`);
        }
        // 3. 地址快照
        let receiverSnapshot = null;
        if (input.addressId) {
            const addr = await this.prisma.address.findUnique({ where: { id: input.addressId } });
            if (addr)
                receiverSnapshot = addr;
        }
        const orderNo = `${input.channel === 'wholesale' ? 'WS' : 'RT'}${Date.now()}${Math.floor(Math.random() * 1000)}`;
        return this.prisma.$transaction(async (tx) => {
            // 4. 占用库存（reserved += qty）
            for (const it of input.items) {
                const stocks = await tx.stock.findMany({ where: { skuId: it.skuId } });
                if (!stocks.length)
                    throw new common_1.BadRequestException('库存记录缺失');
                let remain = it.qty;
                for (const s of stocks) {
                    const available = s.onHand - s.reserved;
                    if (available <= 0)
                        continue;
                    const take = Math.min(remain, available);
                    await tx.stock.update({
                        where: { id: s.id },
                        data: { reserved: s.reserved + take },
                    });
                    remain -= take;
                    if (remain === 0)
                        break;
                }
                if (remain > 0)
                    throw new common_1.BadRequestException('库存不足');
            }
            // 5. 扣授信（若适用）
            if (input.useCredit && user.distributor) {
                await tx.distributor.update({
                    where: { id: user.distributor.id },
                    data: { creditUsed: { increment: totalAmount } },
                });
            }
            const freight = input.freight || 0;
            return tx.order.create({
                data: {
                    orderNo,
                    userId: input.userId,
                    channel: input.channel,
                    source: input.source || (input.channel === 'wholesale' ? 'miniprogram_b' : 'miniprogram_a'),
                    status: input.useCredit ? 'pending_ship' : 'pending_pay',
                    totalAmount: totalAmount + freight,
                    freight,
                    paidAmount: input.useCredit ? totalAmount + freight : 0,
                    paidAt: input.useCredit ? new Date() : null,
                    useCredit: !!input.useCredit,
                    payMethod: input.useCredit ? 'credit' : input.payMethod,
                    addressId: input.addressId,
                    receiverSnapshot,
                    remark: input.remark,
                    items: { create: itemRecords },
                },
                include: { items: true },
            });
        });
    }
    // -------------------- 状态机 --------------------
    async markPaid(orderId, payTransId) {
        const order = await this.findById(orderId);
        if (order.status !== 'pending_pay')
            throw new common_1.BadRequestException('订单状态不允许支付');
        return this.prisma.order.update({
            where: { id: BigInt(orderId) },
            data: {
                status: 'pending_ship',
                paidAt: new Date(),
                paidAmount: order.totalAmount,
                payTransId,
            },
        });
    }
    async ship(orderId, company, trackingNo, operator) {
        const order = await this.findById(orderId);
        if (order.status !== 'pending_ship')
            throw new common_1.BadRequestException('订单状态不允许发货');
        const shippedOrder = await this.prisma.$transaction(async (tx) => {
            // 实际扣减库存：reserved -= qty，onHand -= qty
            for (const it of order.items) {
                const stocks = await tx.stock.findMany({ where: { skuId: it.skuId } });
                let remain = it.qty;
                for (const s of stocks) {
                    if (s.reserved <= 0 || remain <= 0)
                        continue;
                    const take = Math.min(remain, s.reserved);
                    await tx.stock.update({
                        where: { id: s.id },
                        data: {
                            reserved: s.reserved - take,
                            onHand: s.onHand - take,
                        },
                    });
                    await tx.stockLog.create({
                        data: {
                            orderNo: order.orderNo,
                            type: 'out',
                            skuId: it.skuId,
                            warehouseId: s.warehouseId,
                            qty: take,
                            beforeOnHand: s.onHand,
                            afterOnHand: s.onHand - take,
                            relatedId: Number(order.id),
                            relatedType: 'order',
                            operator,
                            remark: `订单发货 ${order.orderNo}`,
                        },
                    });
                    remain -= take;
                    if (remain === 0)
                        break;
                }
            }
            // 累计商品销量 + 用户总消费
            for (const it of order.items) {
                await tx.product.update({
                    where: { id: it.productId },
                    data: { salesCount: { increment: it.qty } },
                });
            }
            if (order.userId) {
                await tx.user.update({
                    where: { id: order.userId },
                    data: { totalSpent: { increment: Number(order.totalAmount) } },
                });
            }
            return tx.order.update({
                where: { id: BigInt(orderId) },
                data: {
                    status: 'shipped',
                    logisticsCompany: company,
                    trackingNo,
                    shippedAt: new Date(),
                },
                include: {
                    user: true,
                    address: true,
                    items: true,
                },
            });
        });
        if (shippedOrder.payMethod === 'wechat') {
            this.wechatPay
                .uploadShippingInfo({
                transactionId: shippedOrder.payTransId,
                outTradeNo: shippedOrder.orderNo,
                openid: shippedOrder.user?.openid || null,
                logisticsCompany: company,
                trackingNo,
            })
                .catch((error) => {
                this.logger.warn(`微信发货信息录入异常: ${error?.message || error}`);
            });
            this.wechatPay
                .sendShippingSubscribeMessage({
                openid: shippedOrder.user?.openid || null,
                orderNo: shippedOrder.orderNo,
                logisticsCompany: company,
                trackingNo,
            })
                .catch((error) => {
                this.logger.warn(`微信订阅消息发送异常: ${error?.message || error}`);
            });
        }
        return shippedOrder;
    }
    async complete(orderId) {
        const order = await this.findById(orderId);
        if (order.status !== 'shipped')
            throw new common_1.BadRequestException('订单状态不允许完成');
        return this.prisma.order.update({
            where: { id: BigInt(orderId) },
            data: { status: 'completed', completedAt: new Date() },
        });
    }
    async close(orderId, reason) {
        const order = await this.findById(orderId);
        if (!['pending_pay', 'pending_ship'].includes(order.status))
            throw new common_1.BadRequestException('订单状态不允许关闭');
        return this.prisma.$transaction(async (tx) => {
            // 释放占用库存
            for (const it of order.items) {
                const stocks = await tx.stock.findMany({ where: { skuId: it.skuId } });
                let remain = it.qty;
                for (const s of stocks) {
                    if (s.reserved <= 0 || remain <= 0)
                        continue;
                    const give = Math.min(remain, s.reserved);
                    await tx.stock.update({
                        where: { id: s.id },
                        data: { reserved: s.reserved - give },
                    });
                    remain -= give;
                    if (remain === 0)
                        break;
                }
            }
            // 释放授信
            if (order.useCredit && order.userId) {
                const dist = await tx.distributor.findUnique({ where: { userId: order.userId } });
                if (dist) {
                    await tx.distributor.update({
                        where: { id: dist.id },
                        data: { creditUsed: { decrement: Number(order.totalAmount) } },
                    });
                }
            }
            return tx.order.update({
                where: { id: BigInt(orderId) },
                data: { status: 'closed', closedAt: new Date(), remark: reason },
            });
        });
    }
    /** 退款：置为售后状态，并把金额/原因写入备注 */
    async refund(orderId, amount, reason) {
        const order = await this.findById(orderId);
        if (!['pending_ship', 'shipped', 'completed'].includes(order.status))
            throw new common_1.BadRequestException('订单当前状态无法发起退款');
        const refundAmt = amount !== undefined ? amount : Number(order.paidAmount ?? 0);
        const remark = [`[退款 ¥${refundAmt}]`, reason, order.remark].filter(Boolean).join(' / ');
        return this.prisma.order.update({
            where: { id: BigInt(orderId) },
            data: { status: 'after_sale', remark },
        });
    }
};
exports.OrderService = OrderService;
exports.OrderService = OrderService = OrderService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        price_tier_service_1.PriceTierService,
        inventory_service_1.InventoryService,
        wechat_pay_service_1.WechatPayService])
], OrderService);
//# sourceMappingURL=order.service.js.map