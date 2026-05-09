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
exports.SkuService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../common/prisma.service");
let SkuService = class SkuService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    /**
     * 给 SKU 列表追加 totalOnHand / availableQty / stock 三个等价字段
     * （简化版：库存只剩 onHand，跨仓求和即可）
     */
    async withStockAgg(skus) {
        if (!skus.length)
            return [];
        const ids = skus.map((s) => s.id);
        const rows = await this.prisma.stock.findMany({
            where: { skuId: { in: ids } },
            select: { skuId: true, onHand: true },
        });
        const map = new Map();
        for (const r of rows) {
            map.set(r.skuId, (map.get(r.skuId) || 0) + r.onHand);
        }
        return skus.map((s) => {
            const onHand = map.get(s.id) || 0;
            return {
                ...s,
                totalOnHand: onHand,
                availableQty: onHand,
                // 兼容：旧前端字段 stock 仍指向"可用库存"
                stock: onHand,
            };
        });
    }
    async findByProduct(productId) {
        const skus = await this.prisma.sku.findMany({
            where: { productId },
            orderBy: { id: 'asc' },
            include: { priceTiers: { orderBy: { minQty: 'asc' } } },
        });
        return this.withStockAgg(skus);
    }
    async findById(id) {
        const s = await this.prisma.sku.findUnique({
            where: { id },
            include: {
                product: { select: { id: true, name: true, code: true, mainImage: true } },
                priceTiers: { orderBy: { minQty: 'asc' } },
            },
        });
        if (!s)
            throw new common_1.NotFoundException('SKU 不存在');
        const [withAgg] = await this.withStockAgg([s]);
        return withAgg;
    }
    /**
     * 更新 SKU 售价
     * 仅操作 SKU 表自身的 retailPrice / memberPrice；
     * 批发阶梯价由 priceTier 模块单独维护，避免和阶梯档冲突。
     */
    async updatePrice(id, payload) {
        const sku = await this.prisma.sku.findUnique({ where: { id }, select: { id: true } });
        if (!sku)
            throw new common_1.NotFoundException('SKU 不存在');
        const data = {};
        if (payload.retailPrice != null) {
            const v = Number(payload.retailPrice);
            if (!isFinite(v) || v < 0)
                throw new common_1.NotFoundException('零售价无效');
            data.retailPrice = v;
        }
        if (payload.memberPrice !== undefined) {
            // 允许传 null/0 清掉会员价
            const v = payload.memberPrice == null ? null : Number(payload.memberPrice);
            if (v != null && (!isFinite(v) || v < 0))
                throw new common_1.NotFoundException('会员价无效');
            data.memberPrice = v;
        }
        if (Object.keys(data).length === 0) {
            // 没有要改的字段，直接返回当前值
            return this.findById(id);
        }
        await this.prisma.sku.update({ where: { id }, data });
        return this.findById(id);
    }
    /**
     * 更新 SKU 库存：写入默认仓库的 Stock.onHand
     */
    async updateStock(id, stock) {
        const sku = await this.prisma.sku.findUnique({ where: { id }, select: { id: true } });
        if (!sku)
            throw new common_1.NotFoundException('SKU 不存在');
        const wh = (await this.prisma.warehouse.findFirst({
            where: { isDefault: true, status: 1 },
            orderBy: { id: 'asc' },
        })) ||
            (await this.prisma.warehouse.findFirst({ where: { status: 1 }, orderBy: { id: 'asc' } }));
        if (!wh)
            throw new common_1.NotFoundException('未配置任何启用中的仓库，请先到"库存管理 > 仓库"新建');
        const safe = Math.max(Number(stock) || 0, 0);
        await this.prisma.stock.upsert({
            where: { skuId_warehouseId: { skuId: id, warehouseId: wh.id } },
            create: { skuId: id, warehouseId: wh.id, onHand: safe },
            update: { onHand: safe },
        });
        return this.findById(id);
    }
};
exports.SkuService = SkuService;
exports.SkuService = SkuService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], SkuService);
//# sourceMappingURL=sku.service.js.map