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
const kuaidi100_service_1 = require("../logistics/kuaidi100.service");
const work_wx_service_1 = require("../notify/work-wx.service");
function normalizeOrderChannel(channel) {
    const value = String(channel || '').trim();
    if (!value || value === 'all')
        return undefined;
    if (value === 'retail' || value === 'wholesale' || value === 'live' || value === 'offline')
        return value;
    return undefined;
}
let OrderService = OrderService_1 = class OrderService {
    constructor(prisma, priceTier, inventory, wechatPay, kuaidi100, workWx) {
        this.prisma = prisma;
        this.priceTier = priceTier;
        this.inventory = inventory;
        this.wechatPay = wechatPay;
        this.kuaidi100 = kuaidi100;
        this.workWx = workWx;
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
        if (!order.logisticsCompany || !order.trackingNo) {
            return {
                supported: false,
                message: '订单暂未发货，无物流单号',
                company: order.logisticsCompany || '',
                trackingNo: order.trackingNo || '',
                traces: [],
            };
        }
        // 优先调快递100，未配置时回退到 wechatPay 老逻辑（即返回'未接入'占位）
        if (this.kuaidi100.isEnabled()) {
            try {
                // 收件人手机号尾 4 位（顺丰系必填，其他快递可选）。
                // receiverSnapshot 是下单时快照，比 user.address 更准
                const recv = order.receiverSnapshot || {};
                const phone = (recv.phone || '').toString().slice(-4);
                const traces = await this.kuaidi100.queryTrack({
                    com: this.normalizeCarrierCode(order.logisticsCompany),
                    num: order.trackingNo,
                    phone,
                });
                return {
                    supported: true,
                    source: 'kuaidi100',
                    message: 'ok',
                    company: order.logisticsCompany,
                    trackingNo: order.trackingNo,
                    traces,
                };
            }
            catch (err) {
                this.logger.warn(`[Logistics] 快递100查询失败: ${err?.message || err}`);
                return {
                    supported: false,
                    source: 'kuaidi100',
                    message: err?.message || '物流查询失败',
                    company: order.logisticsCompany,
                    trackingNo: order.trackingNo,
                    traces: [],
                };
            }
        }
        return this.wechatPay.queryLogistics({
            logisticsCompany: order.logisticsCompany,
            trackingNo: order.trackingNo,
        });
    }
    /**
     * 把后台用户输入的中文/拼音公司名映射到快递100 标准 com 编码。
     * 后台填'顺丰' / 'shunfeng' / 'SF' 都能识别。未识别时按小写返回（KD100 也接受常见英文）
     */
    normalizeCarrierCode(input) {
        const raw = (input || '').trim().toLowerCase();
        if (!raw)
            return raw;
        const map = {
            顺丰: 'shunfeng',
            顺丰速运: 'shunfeng',
            sf: 'shunfeng',
            sf速运: 'shunfeng',
            圆通: 'yuantong',
            圆通速递: 'yuantong',
            yt: 'yuantong',
            中通: 'zhongtong',
            中通快递: 'zhongtong',
            zt: 'zhongtong',
            申通: 'shentong',
            申通快递: 'shentong',
            韵达: 'yunda',
            韵达快递: 'yunda',
            京东: 'jd',
            京东物流: 'jd',
            邮政: 'youzhengguonei',
            邮政快递包裹: 'youzhengguonei',
            ems: 'ems',
            德邦: 'debangkuaidi',
            德邦快递: 'debangkuaidi',
            德邦物流: 'debangwuliu',
            百世: 'huitongkuaidi',
            百世快递: 'huitongkuaidi',
            极兔: 'jtexpress',
            极兔速递: 'jtexpress',
            jt: 'jtexpress',
        };
        return map[raw] || raw;
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
        // 运费策略：取所有"非包邮"商品中 shippingFee 最大值；全部包邮 -> 0
        // （后续若做按收货地址分省加价，把这里换成模板查询即可，前端无需改动）
        let computedFreightMax = 0;
        let allFreeShipping = true;
        for (const it of input.items) {
            const sku = await this.prisma.sku.findUnique({
                where: { id: it.skuId },
                include: { product: true },
            });
            if (!sku)
                throw new common_1.BadRequestException(`SKU ${it.skuId} 不存在`);
            let unitPrice = Number(sku.retailPrice);
            if (input.channel === 'wholesale') {
                const product = sku.product;
                // 1. 商品必须开启批发渠道
                if (!product.wholesaleEnabled) {
                    throw new common_1.BadRequestException(`${product.name} 暂不支持批发下单`);
                }
                // 2. product 级硬性起订量校验（前端 getMinWholesaleQty 也优先取这个值，
                //    所以 UI 显示的"≥ N 件起批"就是这个 N）
                const productMoq = Number(product.minWholesaleQty || 1);
                if (it.qty < productMoq) {
                    throw new common_1.BadRequestException(`${product.name} 起订量 ${productMoq} 件，当前 ${it.qty} 件`);
                }
                // 3. 阶梯价匹配
                //    - 没配阶梯价 (tiers=[]) → 兜底用 sku.retailPrice，不再误报"未达起订量"
                //    - 配了阶梯价但 qty 没命中任何档位 → 报具体档位信息
                const tiers = await this.priceTier.listBySku(it.skuId);
                if (tiers.length === 0) {
                    // 没配阶梯：批发价 = retailPrice（与零售同价，仅靠 product 级 MOQ 控量）
                    unitPrice = Number(sku.retailPrice);
                }
                else {
                    const tierPrice = await this.priceTier.matchPrice(it.skuId, it.qty);
                    if (tierPrice == null) {
                        const firstMin = Number(tiers[0].minQty);
                        throw new common_1.BadRequestException(`${product.name} 阶梯价最低 ${firstMin} 件起，当前 ${it.qty} 件`);
                    }
                    unitPrice = tierPrice;
                }
            }
            else if (user.levelId && sku.memberPrice) {
                unitPrice = Number(sku.memberPrice);
            }
            const subtotal = unitPrice * it.qty;
            totalAmount += subtotal;
            // 累计运费：注意 prisma Decimal 字段需 Number()
            const productFree = sku.product.freeShipping === true;
            const productFee = Number(sku.product.shippingFee || 0);
            if (!productFree) {
                allFreeShipping = false;
                if (productFee > computedFreightMax)
                    computedFreightMax = productFee;
            }
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
        const createdOrder = await this.prisma.$transaction(async (tx) => {
            // 简化版（v2）：下单直接扣 onHand，不再走 reserved 占用 → 付款扣减的两段式
            // 优点：库存模型简单，管理端"库存数量"就是用户能买到的量
            // 缺点：未付款订单也占库存；如果订单被关闭/取消，需要返还库存（见 cancelOrder/closeOrder）
            for (const it of input.items) {
                const stocks = await tx.stock.findMany({ where: { skuId: it.skuId } });
                if (!stocks.length) {
                    const sku = await tx.sku.findUnique({
                        where: { id: it.skuId },
                        include: { product: { select: { name: true } } },
                    });
                    if (!sku) {
                        throw new common_1.BadRequestException(`SKU ${it.skuId} 不存在，请确认前端是否误传了 productId`);
                    }
                    throw new common_1.BadRequestException(`「${sku.product.name} / ${sku.code}」(skuId=${sku.id}) 还未建立库存记录，请到管理端"库存管理"录入`);
                }
                let remain = it.qty;
                for (const s of stocks) {
                    if (s.onHand <= 0)
                        continue;
                    const take = Math.min(remain, s.onHand);
                    await tx.stock.update({
                        where: { id: s.id },
                        data: { onHand: s.onHand - take },
                    });
                    remain -= take;
                    if (remain === 0)
                        break;
                }
                if (remain > 0) {
                    const sku = await tx.sku.findUnique({
                        where: { id: it.skuId },
                        include: { product: { select: { name: true } } },
                    });
                    throw new common_1.BadRequestException(`「${sku?.product.name || ''} / ${sku?.code || it.skuId}」库存不足`);
                }
            }
            // 5. 扣授信（若适用）
            if (input.useCredit && user.distributor) {
                await tx.distributor.update({
                    where: { id: user.distributor.id },
                    data: { creditUsed: { increment: totalAmount } },
                });
            }
            // 运费：批发/授信下单允许调用方传 input.freight（如线下议价单）；
            // 普通零售订单一律按商品配置自动计算
            const autoFreight = allFreeShipping ? 0 : computedFreightMax;
            const freight = input.freight != null && input.freight >= 0 ? Number(input.freight) : autoFreight;
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
        // 三条通知互斥：授信单 → 授信卡片；普通单 → 「新订单待付款」卡片；
        // 后续 markPaid 时再发「已付款」卡片。
        if (input.useCredit && user.distributor) {
            this.notifyCreditOrder(createdOrder, user, totalAmount).catch((err) => this.logger.warn(`[Notify] sendCreditOrder 异常: ${err?.message || err}`));
        }
        else {
            this.notifyOrderCreated(createdOrder).catch((err) => this.logger.warn(`[Notify] sendOrderCreated 异常: ${err?.message || err}`));
        }
        return createdOrder;
    }
    /** 新订单创建后给运营群推送「待付款」卡片 */
    async notifyOrderCreated(createdOrder) {
        if (!this.workWx.isEnabled())
            return;
        const snap = createdOrder.receiverSnapshot || {};
        await this.workWx.sendOrderCreated({
            orderNo: createdOrder.orderNo,
            channel: createdOrder.channel,
            totalAmount: Number(createdOrder.totalAmount),
            payMethod: createdOrder.payMethod,
            receiver: snap.name || snap.contact || null,
            receiverPhone: snap.phone || null,
            receiverAddress: [snap.province, snap.city, snap.district, snap.detail]
                .filter(Boolean)
                .join(' ') || null,
            items: (createdOrder.items || []).map((it) => ({
                productName: it.productName,
                qty: it.qty,
            })),
        });
    }
    /** 授信下单后给运营群播报：分销商名 / 订单金额 / 当前授信使用率 */
    async notifyCreditOrder(createdOrder, user, totalAmount) {
        if (!this.workWx.isEnabled())
            return;
        // 重新拉一次 distributor 拿最新已用额度（事务内 increment 后的值）
        const dist = await this.prisma.distributor.findUnique({
            where: { id: user.distributor.id },
        });
        if (!dist)
            return;
        await this.workWx.sendCreditOrderCreated({
            orderNo: createdOrder.orderNo,
            distributorName: dist.companyName || user.nickname || user.phone,
            totalAmount,
            creditUsed: Number(dist.creditUsed),
            creditLimit: Number(dist.creditLimit),
            items: (createdOrder.items || []).map((it) => ({
                productName: it.productName,
                qty: it.qty,
            })),
        });
    }
    // -------------------- 状态机 --------------------
    async markPaid(orderId, payTransId) {
        const order = await this.findById(orderId);
        if (order.status !== 'pending_pay')
            throw new common_1.BadRequestException('订单状态不允许支付');
        const updated = await this.prisma.order.update({
            where: { id: BigInt(orderId) },
            data: {
                status: 'pending_ship',
                paidAt: new Date(),
                paidAmount: order.totalAmount,
                payTransId,
            },
        });
        // 异步推企业微信群（失败仅 warn，不阻塞主链路；不 await，订单接口立即返回）
        this.notifyOrderPaid(order).catch((err) => this.logger.warn(`[Notify] sendOrderPaid 异常: ${err?.message || err}`));
        return updated;
    }
    /**
     * 组装订单付款企微通知。
     * order 来自 findById，已 include user/address/items
     */
    async notifyOrderPaid(order) {
        if (!this.workWx.isEnabled())
            return;
        const recv = order.receiverSnapshot || order.address || {};
        const receiverAddress = [
            recv.province,
            recv.city,
            recv.district,
            recv.detail,
        ]
            .filter(Boolean)
            .join(' ');
        await this.workWx.sendOrderPaid({
            orderNo: order.orderNo,
            channel: order.channel,
            totalAmount: Number(order.totalAmount),
            payMethod: order.payMethod,
            receiver: recv.receiver || null,
            receiverPhone: recv.phone || null,
            receiverAddress: receiverAddress || null,
            items: (order.items || []).map((it) => ({
                productName: it.productName,
                qty: it.qty,
            })),
        });
    }
    async ship(orderId, company, trackingNo, operator) {
        const order = await this.findById(orderId);
        if (order.status !== 'pending_ship')
            throw new common_1.BadRequestException('订单状态不允许发货');
        void operator;
        const shippedOrder = await this.prisma.$transaction(async (tx) => {
            // 简化版（v2）：库存在下单时已直接 onHand -= qty，发货时不再扣减；
            // stock_logs 表已删，发货流水不再保留
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
            // 用户来自哪个小程序就用对应 AppID 的 access_token 调发货录入和订阅消息接口
            const userChannel = shippedOrder.user?.appChannel === 'wholesale' ? 'wholesale' : 'retail';
            this.wechatPay
                .uploadShippingInfo({
                transactionId: shippedOrder.payTransId,
                outTradeNo: shippedOrder.orderNo,
                openid: shippedOrder.user?.openid || null,
                logisticsCompany: company,
                trackingNo,
                channel: userChannel,
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
                channel: userChannel,
            })
                .catch((error) => {
                this.logger.warn(`微信订阅消息发送异常: ${error?.message || error}`);
            });
        }
        // 注册快递100 订阅推送：以后每次轨迹更新 KD100 都会主动 POST 我们 webhook
        // 失败仅 warn，不阻塞发货流程；用户首次进物流页时仍可现场查询
        if (this.kuaidi100.isEnabled()) {
            const recv = shippedOrder.receiverSnapshot || shippedOrder.address || {};
            const phone = (recv.phone || '').toString().slice(-4);
            this.kuaidi100
                .subscribeTrack({
                com: this.normalizeCarrierCode(company),
                num: trackingNo,
                phone,
            })
                .then((res) => {
                if (res?.result === false || res?.returnCode !== '200') {
                    this.logger.warn(`[Kuaidi100] subscribe 提示 returnCode=${res?.returnCode} message=${res?.message}`);
                }
            })
                .catch((err) => this.logger.warn(`[Kuaidi100] subscribeTrack 异常: ${err?.message || err}`));
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
            // 简化版（v2）：下单已直扣 onHand，关闭订单时把数量返还到第一个有库存的仓库
            // 优先返还到下单时实际扣减的仓库（按 stocks.id 升序找第一个），
            // 找不到任何 stocks 记录就 skip（极端情况：仓库已被删除）
            for (const it of order.items) {
                const stocks = await tx.stock.findMany({
                    where: { skuId: it.skuId },
                    orderBy: { id: 'asc' },
                });
                const target = stocks[0];
                if (!target)
                    continue;
                await tx.stock.update({
                    where: { id: target.id },
                    data: { onHand: { increment: it.qty } },
                });
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
    /**
     * 处理快递100 订阅推送：根据 trackingNo 找订单 → 终态时推企微 + 自动 complete
     * webhook controller 调用，永远不抛异常（KD100 webhook 必须固定 ACK 否则会重试）
     */
    async applyKuaidi100Push(payload) {
        const { trackingNo, state, company, lastContext } = payload;
        if (!trackingNo)
            return;
        const order = await this.prisma.order.findFirst({
            where: { trackingNo },
            orderBy: { id: 'desc' }, // 同一单号只会有一笔，但按时间倒序更稳
        });
        if (!order) {
            this.logger.warn(`[Kuaidi100][Push] 找不到 trackingNo=${trackingNo} 对应的订单，可能已删除`);
            return;
        }
        // 终态映射 → 推企微 + 触发后续动作
        if (state === '3') {
            // 已签收：推企微 + 自动 complete（如果当前是 shipped）
            this.workWx
                .sendLogisticsTerminal({
                orderNo: order.orderNo,
                company: company || order.logisticsCompany || '',
                trackingNo,
                state: 'signed',
                lastContext,
            })
                .catch((err) => this.logger.warn(`[Notify] sendLogisticsTerminal 异常: ${err?.message || err}`));
            if (order.status === 'shipped') {
                try {
                    await this.complete(order.id);
                    this.logger.log(`[Kuaidi100][Push] 订单 ${order.orderNo} 自动确认收货`);
                }
                catch (err) {
                    this.logger.warn(`[Kuaidi100][Push] 自动 complete 失败: ${err?.message || err}`);
                }
            }
        }
        else if (state === '4' || state === '7') {
            // 退签 / 拒签
            this.workWx
                .sendLogisticsTerminal({
                orderNo: order.orderNo,
                company: company || order.logisticsCompany || '',
                trackingNo,
                state: state === '4' ? 'returned' : 'rejected',
                lastContext,
            })
                .catch((err) => this.logger.warn(`[Notify] sendLogisticsTerminal 异常: ${err?.message || err}`));
        }
        else if (state === '2') {
            // 疑难件
            this.workWx
                .sendLogisticsTerminal({
                orderNo: order.orderNo,
                company: company || order.logisticsCompany || '',
                trackingNo,
                state: 'problem',
                lastContext,
            })
                .catch((err) => this.logger.warn(`[Notify] sendLogisticsTerminal 异常: ${err?.message || err}`));
        }
        // 其他在途状态（0 在途 / 1 揽件 / 5 同城派送 ...）只记日志，不打扰运营
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
        wechat_pay_service_1.WechatPayService,
        kuaidi100_service_1.Kuaidi100Service,
        work_wx_service_1.WorkWxService])
], OrderService);
//# sourceMappingURL=order.service.js.map