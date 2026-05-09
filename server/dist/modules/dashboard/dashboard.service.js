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
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../common/prisma.service");
let DashboardService = class DashboardService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    /**
     * 简化版：跨仓库聚合，统计 onHand <= threshold 的 SKU 数量。
     * 没有任何 Stock 记录的 SKU 也算低库存（视为 0）。
     */
    async computeLowStockCount(threshold) {
        const grouped = await this.prisma.stock.groupBy({
            by: ['skuId'],
            _sum: { onHand: true },
        });
        const skuIdsWithStock = new Set(grouped.map((g) => g.skuId));
        let low = grouped.filter((g) => (g._sum.onHand || 0) <= threshold).length;
        const noStockCount = await this.prisma.sku.count({
            where: { status: 1, id: { notIn: Array.from(skuIdsWithStock) } },
        });
        low += noStockCount;
        return low;
    }
    async overview(channel) {
        const channelFilter = channel === 'wholesale' || channel === 'retail' ? channel : undefined;
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);
        const [productCount, skuCount, retailCustomerCount, dealerCount, pendingAuditCount, todayOrderCount, todayOrderAmount, pendingShipCount, lowStockCount,] = await Promise.all([
            this.prisma.product.count(),
            this.prisma.sku.count(),
            // 零售客户：角色 retail 的用户
            this.prisma.user.count({ where: { role: 'retail' } }),
            // 分销商：审核通过
            this.prisma.distributor.count({ where: { auditStatus: 'approved' } }),
            // 分销商：待审核
            this.prisma.distributor.count({ where: { auditStatus: 'pending' } }),
            // 今日订单数
            this.prisma.order.count({
                where: {
                    createdAt: { gte: todayStart, lte: todayEnd },
                    ...(channelFilter ? { channel: channelFilter } : {}),
                },
            }),
            // 今日已付金额：paidAt 非空
            this.prisma.order.aggregate({
                where: {
                    createdAt: { gte: todayStart, lte: todayEnd },
                    paidAt: { not: null },
                    ...(channelFilter ? { channel: channelFilter } : {}),
                },
                _sum: { paidAmount: true },
            }),
            // 待发货：已付款但未发货
            this.prisma.order.count({
                where: {
                    status: 'pending_ship',
                    ...(channelFilter ? { channel: channelFilter } : {}),
                },
            }),
            // 低库存 SKU：跨仓库聚合 onHand <= 20 的 SKU 个数（库存唯一真源是 Stock 表）
            this.computeLowStockCount(20),
        ]);
        return {
            productCount,
            skuCount,
            retailCustomerCount,
            dealerCount,
            pendingAuditCount,
            todayOrderCount,
            todayOrderAmount: Number(todayOrderAmount._sum?.paidAmount ?? 0),
            pendingShipCount,
            lowStockCount,
        };
    }
    async salesTrend(days = 30) {
        const start = new Date();
        start.setDate(start.getDate() - days + 1);
        start.setHours(0, 0, 0, 0);
        const orders = await this.prisma.order.findMany({
            where: { createdAt: { gte: start }, paidAt: { not: null } },
            select: { createdAt: true, paidAmount: true, channel: true },
        });
        const map = new Map();
        for (let i = 0; i < days; i++) {
            const d = new Date(start);
            d.setDate(start.getDate() + i);
            map.set(d.toISOString().slice(0, 10), { retail: 0, wholesale: 0 });
        }
        for (const o of orders) {
            const key = o.createdAt.toISOString().slice(0, 10);
            const entry = map.get(key);
            if (!entry)
                continue;
            if (o.channel === 'wholesale')
                entry.wholesale += Number(o.paidAmount);
            else
                entry.retail += Number(o.paidAmount);
        }
        return Array.from(map.entries()).map(([date, val]) => ({ date, ...val }));
    }
    async topProducts(limit = 10) {
        const groups = await this.prisma.orderItem.groupBy({
            by: ['productId'],
            _sum: { qty: true, subtotal: true },
            orderBy: { _sum: { subtotal: 'desc' } },
            take: limit,
        });
        const products = await this.prisma.product.findMany({
            where: { id: { in: groups.map(g => g.productId) } },
        });
        const pm = new Map(products.map(p => [p.id, p]));
        return groups.map(g => ({
            productId: g.productId,
            name: pm.get(g.productId)?.name || '-',
            image: pm.get(g.productId)?.mainImage || '',
            quantity: Number(g._sum?.qty ?? 0),
            amount: Number(g._sum?.subtotal ?? 0),
        }));
    }
};
exports.DashboardService = DashboardService;
exports.DashboardService = DashboardService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], DashboardService);
//# sourceMappingURL=dashboard.service.js.map