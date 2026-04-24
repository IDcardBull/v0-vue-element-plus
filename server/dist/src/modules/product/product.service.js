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
        const [list, total] = await this.prisma.$transaction([
            this.prisma.product.findMany({
                where,
                orderBy: [{ id: 'desc' }],
                skip: (page - 1) * pageSize,
                take: pageSize,
                include: {
                    category: { select: { id: true, name: true } },
                    brand: { select: { id: true, name: true } },
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
        const tierCount = await this.prisma.priceTier.groupBy({
            by: ['skuId'],
            where: { sku: { productId: { in: ids } } },
            _count: true,
        });
        const stockMap = new Map(skuAgg.map((s) => [s.productId, s._sum.stock || 0]));
        return {
            list: list.map((p) => ({
                ...p,
                skuCount: p._count.skus,
                totalStock: stockMap.get(p.id) || 0,
                priceTierCount: tierCount.filter((t) => t).length, // simplified
            })),
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
        // 简化处理：先删全部 SKU 再重建（生产建议逐条 upsert）
        if (Array.isArray(skus)) {
            await this.prisma.$transaction(async (tx) => {
                await tx.product.update({ where: { id }, data: rest });
                const existingSkus = await tx.sku.findMany({ where: { productId: id } });
                const keepIds = skus.filter((s) => s.id).map((s) => s.id);
                // 删除不再需要的
                await tx.sku.deleteMany({
                    where: { productId: id, id: { notIn: keepIds.length ? keepIds : [0] } },
                });
                for (const s of skus) {
                    if (s.id) {
                        await tx.sku.update({
                            where: { id: s.id },
                            data: {
                                code: s.code,
                                specs: s.specs,
                                image: s.image,
                                retailPrice: s.retailPrice,
                                memberPrice: s.memberPrice,
                                costPrice: s.costPrice,
                                stock: s.stock,
                                weight: s.weight,
                            },
                        });
                    }
                    else {
                        await tx.sku.create({
                            data: {
                                productId: id,
                                code: s.code,
                                specs: s.specs || {},
                                image: s.image,
                                retailPrice: s.retailPrice || 0,
                                memberPrice: s.memberPrice,
                                costPrice: s.costPrice,
                                stock: s.stock || 0,
                                weight: s.weight,
                            },
                        });
                    }
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