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
exports.InventoryService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../common/prisma.service");
let InventoryService = class InventoryService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    // -------------------- 仓库 --------------------
    async warehouses() {
        return this.prisma.warehouse.findMany({ orderBy: [{ isDefault: 'desc' }, { id: 'asc' }] });
    }
    // -------------------- 实时库存 --------------------
    async stockList(q) {
        const page = Number(q.page) || 1;
        const pageSize = Number(q.pageSize) || 20;
        const where = {};
        if (q.warehouseId)
            where.warehouseId = Number(q.warehouseId);
        if (q.keyword || q.categoryId) {
            where.sku = {
                OR: q.keyword
                    ? [
                        { code: { contains: q.keyword } },
                        { product: { name: { contains: q.keyword } } },
                        { product: { code: { contains: q.keyword } } },
                    ]
                    : undefined,
                product: q.categoryId ? { categoryId: Number(q.categoryId) } : undefined,
            };
        }
        const [list, total] = await this.prisma.$transaction([
            this.prisma.stock.findMany({
                where,
                orderBy: [{ id: 'desc' }],
                skip: (page - 1) * pageSize,
                take: pageSize,
                include: {
                    warehouse: { select: { id: true, name: true, code: true } },
                    sku: {
                        select: {
                            id: true,
                            code: true,
                            specs: true,
                            image: true,
                            product: {
                                select: {
                                    id: true, code: true, name: true, mainImage: true,
                                    category: { select: { name: true } },
                                    brand: { select: { name: true } },
                                },
                            },
                        },
                    },
                },
            }),
            this.prisma.stock.count({ where }),
        ]);
        return { list, total, page, pageSize };
    }
    // -------------------- 库存预警 --------------------
    async warnings(level) {
        const all = await this.prisma.stock.findMany({
            include: {
                warehouse: { select: { name: true } },
                sku: {
                    select: {
                        id: true, code: true, image: true,
                        product: { select: { id: true, name: true, code: true, mainImage: true } },
                    },
                },
            },
        });
        const classified = all.map((s) => {
            const available = s.onHand - s.reserved;
            let lv = 'normal';
            if (available <= 0)
                lv = 'urgent';
            else if (available <= s.warnMin)
                lv = 'warning';
            else if (available >= s.warnMax)
                lv = 'excess';
            return { ...s, available, warnLevel: lv };
        });
        return level ? classified.filter((s) => s.warnLevel === level) : classified;
    }
    // -------------------- 出入库记录 --------------------
    async recordList(q) {
        const page = Number(q.page) || 1;
        const pageSize = Number(q.pageSize) || 20;
        const where = {};
        if (q.type)
            where.type = q.type;
        if (q.warehouseId)
            where.warehouseId = Number(q.warehouseId);
        if (q.keyword) {
            where.OR = [
                { orderNo: { contains: q.keyword } },
                { sku: { product: { name: { contains: q.keyword } } } },
            ];
        }
        if (q.dateFrom || q.dateTo) {
            where.createdAt = {};
            if (q.dateFrom)
                where.createdAt.gte = new Date(q.dateFrom);
            if (q.dateTo)
                where.createdAt.lte = new Date(q.dateTo + 'T23:59:59');
        }
        const [list, total] = await this.prisma.$transaction([
            this.prisma.stockLog.findMany({
                where,
                orderBy: { id: 'desc' },
                skip: (page - 1) * pageSize,
                take: pageSize,
                include: {
                    warehouse: { select: { name: true } },
                    sku: { select: { code: true, product: { select: { name: true } } } },
                },
            }),
            this.prisma.stockLog.count({ where }),
        ]);
        return { list, total, page, pageSize };
    }
    /**
     * 核心出入库操作：事务内同时写 stocks + stock_logs
     * in/return: onHand += qty
     * out: onHand -= qty（不足则抛错）
     * inventory: 盘点差异 qty 可正可负
     */
    async stockOp(input) {
        return this.prisma.$transaction(async (tx) => {
            const stock = await tx.stock.findUnique({
                where: { skuId_warehouseId: { skuId: input.skuId, warehouseId: input.warehouseId } },
            });
            if (!stock && input.type === 'out')
                throw new common_1.BadRequestException('该仓库无此 SKU 库存');
            const before = stock?.onHand || 0;
            let delta = input.qty;
            if (input.type === 'out')
                delta = -Math.abs(input.qty);
            else if (input.type === 'in' || input.type === 'return')
                delta = Math.abs(input.qty);
            // transfer 需要两条记录，调用方自行拆分为一出一入
            const after = before + delta;
            if (after < 0)
                throw new common_1.BadRequestException(`库存不足：当前 ${before}，拟 ${delta}`);
            await tx.stock.upsert({
                where: { skuId_warehouseId: { skuId: input.skuId, warehouseId: input.warehouseId } },
                update: { onHand: after },
                create: {
                    skuId: input.skuId, warehouseId: input.warehouseId, onHand: after,
                },
            });
            await tx.stockLog.create({
                data: {
                    orderNo: input.orderNo,
                    type: input.type,
                    skuId: input.skuId,
                    warehouseId: input.warehouseId,
                    qty: Math.abs(input.qty),
                    beforeOnHand: before,
                    afterOnHand: after,
                    operator: input.operator,
                    remark: input.remark,
                    relatedId: input.relatedId,
                    relatedType: input.relatedType,
                },
            });
            // 同步 SKU 表缓存
            const agg = await tx.stock.aggregate({
                where: { skuId: input.skuId },
                _sum: { onHand: true },
            });
            await tx.sku.update({
                where: { id: input.skuId },
                data: { stock: agg._sum.onHand || 0 },
            });
            return { before, after };
        });
    }
};
exports.InventoryService = InventoryService;
exports.InventoryService = InventoryService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], InventoryService);
//# sourceMappingURL=inventory.service.js.map