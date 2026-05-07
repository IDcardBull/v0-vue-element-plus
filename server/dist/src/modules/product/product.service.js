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
exports.ProductService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../common/prisma.service");
let ProductService = class ProductService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async search(q) {
        const page = Number(q.page) || 1;
        const pageSize = Number(q.pageSize) || 20;
        const where = {};
        if (q.keyword) {
            where.OR = [{ name: { contains: q.keyword } }, { code: { contains: q.keyword } }];
        }
        if (q.categoryId)
            where.categoryId = Number(q.categoryId);
        if (q.brandId)
            where.brandId = Number(q.brandId);
        if (q.craft)
            where.craft = q.craft;
        if (q.status !== undefined)
            where.status = Number(q.status);
        if (q.channel === 'retail')
            where.retailEnabled = true;
        if (q.channel === 'wholesale')
            where.wholesaleEnabled = true;
        const sortField = q.sortField || 'id';
        const sortOrder = q.sortOrder || 'desc';
        const [list, total] = await this.prisma.$transaction([
            this.prisma.product.findMany({
                where,
                orderBy: [{ [sortField]: sortOrder }],
                skip: (page - 1) * pageSize,
                take: pageSize,
                include: {
                    category: { select: { id: true, name: true } },
                    brand: { select: { id: true, name: true } },
                    skus: {
                        where: { status: 1 },
                        orderBy: { id: 'asc' },
                        include: { priceTiers: { orderBy: { minQty: 'asc' } } },
                    },
                    _count: { select: { skus: true } },
                },
            }),
            this.prisma.product.count({ where }),
        ]);
        // 对批发商品，附带阶梯价档位数量和总库存
        const ids = list.map((p) => p.id);
        const skuAgg = await this.prisma.sku.groupBy({
            by: ['productId'],
            where: { productId: { in: ids } },
            _sum: { stock: true },
        });
        const priceTiers = await this.prisma.priceTier.findMany({
            where: { sku: { productId: { in: ids } } },
            include: { sku: { select: { productId: true } } },
            orderBy: [{ minQty: 'asc' }],
        });
        const stockMap = new Map(skuAgg.map((s) => [s.productId, s._sum.stock || 0]));
        const tierAggMap = new Map();
        for (const tier of priceTiers) {
            const productId = tier.sku.productId;
            const price = Number(tier.price);
            const current = tierAggMap.get(productId) || { count: 0, minPrice: price, maxPrice: price };
            current.count += 1;
            current.minPrice = Math.min(current.minPrice, price);
            current.maxPrice = Math.max(current.maxPrice, price);
            tierAggMap.set(productId, current);
        }
        return {
            list: list.map((p) => {
                const tierAgg = tierAggMap.get(p.id);
                return {
                    ...p,
                    skuCount: p._count.skus,
                    totalStock: stockMap.get(p.id) || 0,
                    priceTierCount: tierAgg?.count || 0,
                    tierMinPrice: tierAgg?.minPrice || 0,
                    tierMaxPrice: tierAgg?.maxPrice || 0,
                };
            }),
            total,
            page,
            pageSize,
        };
    }
    async findById(id) {
        const p = await this.prisma.product.findUnique({
            where: { id },
            include: {
                category: true,
                brand: true,
                skus: {
                    orderBy: { id: 'asc' },
                    include: { priceTiers: { orderBy: { minQty: 'asc' } } },
                },
            },
        });
        if (!p)
            throw new common_1.NotFoundException('商品不存在');
        return p;
    }
    async create(data) {
        const { skus, ...rest } = data;
        const exist = await this.prisma.product.findUnique({ where: { code: rest.code } });
        if (exist)
            throw new common_1.BadRequestException('商品编码已存在');
        return this.prisma.product.create({
            data: {
                ...rest,
                skus: skus?.length
                    ? {
                        create: skus.map((s) => ({
                            code: s.code,
                            specs: s.specs || {},
                            image: s.image,
                            retailPrice: s.retailPrice || 0,
                            memberPrice: s.memberPrice,
                            costPrice: s.costPrice,
                            stock: s.stock || 0,
                            weight: s.weight,
                        })),
                    }
                    : undefined,
            },
            include: { skus: true },
        });
    }
    async update(id, data) {
        const { skus, ...rest } = data;
        await this.findById(id);
        // SKU 已可能被库存、流水、订单等表引用，不能直接删除；改为 upsert/禁用旧 SKU。
        if (Array.isArray(skus)) {
            await this.prisma.$transaction(async (tx) => {
                await tx.product.update({ where: { id }, data: rest });
                const existingSkus = await tx.sku.findMany({ where: { productId: id } });
                const existingById = new Map(existingSkus.map((sku) => [sku.id, sku]));
                const existingByCode = new Map(existingSkus.map((sku) => [sku.code, sku]));
                const touchedIds = [];
                for (const s of skus) {
                    const matchedSku = s.id ? existingById.get(Number(s.id)) : existingByCode.get(s.code);
                    const skuData = {
                        code: s.code,
                        specs: s.specs || {},
                        image: s.image,
                        retailPrice: s.retailPrice || 0,
                        memberPrice: s.memberPrice,
                        costPrice: s.costPrice,
                        stock: s.stock || 0,
                        weight: s.weight,
                        status: s.status ?? 1,
                    };
                    if (matchedSku) {
                        await tx.sku.update({
                            where: { id: matchedSku.id },
                            data: skuData,
                        });
                        touchedIds.push(matchedSku.id);
                    }
                    else {
                        const created = await tx.sku.create({
                            data: {
                                productId: id,
                                ...skuData,
                            },
                        });
                        touchedIds.push(created.id);
                    }
                }
                if (existingSkus.length) {
                    await tx.sku.updateMany({
                        where: {
                            productId: id,
                            id: { notIn: touchedIds.length ? touchedIds : [0] },
                        },
                        data: { status: 0 },
                    });
                }
            });
        }
        else {
            await this.prisma.product.update({ where: { id }, data: rest });
        }
        return this.findById(id);
    }
    async remove(id) {
        // 软删：改为下架
        return this.prisma.product.update({
            where: { id },
            data: { status: 0 },
        });
    }
    /** 上下架 */
    async toggleListing(id) {
        const p = await this.findById(id);
        return this.prisma.product.update({
            where: { id },
            data: { status: p.status === 1 ? 0 : 1 },
        });
    }
    /** 零售开关 */
    async toggleRetail(id) {
        const p = await this.findById(id);
        return this.prisma.product.update({
            where: { id },
            data: { retailEnabled: !p.retailEnabled },
        });
    }
    /** 批发开关 */
    async toggleWholesale(id) {
        const p = await this.findById(id);
        return this.prisma.product.update({
            where: { id },
            data: { wholesaleEnabled: !p.wholesaleEnabled },
        });
    }
    /** 显式设置上下架状态（0/1） */
    async setStatus(id, status) {
        await this.findById(id);
        return this.prisma.product.update({ where: { id }, data: { status } });
    }
    /** 显式设置零售开关 */
    async setRetail(id, enabled) {
        await this.findById(id);
        return this.prisma.product.update({ where: { id }, data: { retailEnabled: enabled } });
    }
    /** 显式设置批发开关 */
    async setWholesale(id, enabled) {
        await this.findById(id);
        return this.prisma.product.update({ where: { id }, data: { wholesaleEnabled: enabled } });
    }
    /** 批量删除 */
    async batchRemove(ids) {
        return this.prisma.product.updateMany({
            where: { id: { in: ids } },
            data: { status: 0 },
        });
    }
};
exports.ProductService = ProductService;
exports.ProductService = ProductService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ProductService);
//# sourceMappingURL=product.service.js.map