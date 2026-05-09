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
function normalizeSkuImage(s) {
    return s?.image || s?.skuImage || s?.sku_image || s?.imageUrl || s?.image_url || undefined;
}
/**
 * 把前端表单 sku.priceTiers 规范化成 PriceTier.create 入参
 * 入参示例：[{ minQty: 6, maxQty: 50, price: 38 }, ...]
 */
function normalizePriceTiers(raw) {
    if (!Array.isArray(raw))
        return [];
    return raw
        .map((t, i) => ({
        minQty: Number(t.minQty ?? t.min_qty ?? 1),
        maxQty: t.maxQty == null && t.max_qty == null
            ? null
            : Number(t.maxQty ?? t.max_qty),
        price: Number(t.price ?? 0),
        sort: Number(t.sort ?? i),
    }))
        .filter((t) => Number.isFinite(t.minQty) && t.minQty >= 1 && Number.isFinite(t.price) && t.price >= 0);
}
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
                    skus: {
                        where: { status: 1 },
                        orderBy: { id: 'asc' },
                        // 列表的 SKU 不带 priceTiers，避免零售端拉到批发阶梯价
                        include: q.channel === 'wholesale' ? { priceTiers: { orderBy: { minQty: 'asc' } } } : undefined,
                    },
                    _count: { select: { skus: true } },
                },
            }),
            this.prisma.product.count({ where }),
        ]);
        // 简化版：库存 = sum(stocks.onHand)，下单直接扣 onHand，不再有 reserved 占用机制
        const ids = list.map((p) => p.id);
        const stockRows = await this.prisma.stock.findMany({
            where: { sku: { productId: { in: ids } } },
            select: { skuId: true, onHand: true, sku: { select: { productId: true } } },
        });
        const stockMap = new Map(); // productId -> totalOnHand
        const skuStockMap = new Map(); // skuId -> totalOnHand
        for (const r of stockRows) {
            const pid = r.sku.productId;
            stockMap.set(pid, (stockMap.get(pid) || 0) + r.onHand);
            skuStockMap.set(r.skuId, (skuStockMap.get(r.skuId) || 0) + r.onHand);
        }
        // 批发列表才需要返回阶梯价聚合
        let tierAggMap = new Map();
        if (q.channel === 'wholesale') {
            const priceTiers = await this.prisma.priceTier.findMany({
                where: { sku: { productId: { in: ids } } },
                include: { sku: { select: { productId: true } } },
                orderBy: [{ minQty: 'asc' }],
            });
            for (const tier of priceTiers) {
                const productId = tier.sku.productId;
                const price = Number(tier.price);
                const current = tierAggMap.get(productId) || { count: 0, minPrice: price, maxPrice: price };
                current.count += 1;
                current.minPrice = Math.min(current.minPrice, price);
                current.maxPrice = Math.max(current.maxPrice, price);
                tierAggMap.set(productId, current);
            }
        }
        return {
            list: list.map((p) => {
                const tierAgg = tierAggMap.get(p.id);
                // 给每个 SKU 注入聚合后的库存字段（与 findById 口径一致）
                const skus = (p.skus || []).map((s) => {
                    const onHand = skuStockMap.get(s.id) || 0;
                    return {
                        ...s,
                        totalOnHand: onHand,
                        availableQty: onHand,
                        stock: onHand,
                    };
                });
                return {
                    ...p,
                    skus,
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
    /**
     * 商品详情。
     * channel='retail' 时不返回 priceTiers / 批发字段，避免污染零售端。
     * 所有 channel 都会把每个 SKU 的可用库存（Stock 表聚合）注入到 sku.stock。
     */
    async findById(id, channel) {
        const p = await this.prisma.product.findUnique({
            where: { id },
            include: {
                category: true,
                // 编辑/详情页可以回显运费模板名称，零售端不需要也无害
                shippingTemplate: { select: { id: true, name: true, calcType: true } },
                skus: {
                    orderBy: { id: 'asc' },
                    include: channel === 'retail' ? undefined : { priceTiers: { orderBy: { minQty: 'asc' } } },
                },
            },
        });
        if (!p)
            throw new common_1.NotFoundException('商品不存在');
        // 简化：库存 = sum(onHand)，下单直接扣 onHand
        const skuIds = (p.skus || []).map((s) => s.id);
        const stockRows = skuIds.length
            ? await this.prisma.stock.findMany({
                where: { skuId: { in: skuIds } },
                select: { skuId: true, onHand: true },
            })
            : [];
        const stockMap = new Map();
        for (const r of stockRows) {
            stockMap.set(r.skuId, (stockMap.get(r.skuId) || 0) + r.onHand);
        }
        const enrichSku = (s) => {
            const onHand = stockMap.get(s.id) || 0;
            return {
                ...s,
                totalOnHand: onHand,
                availableQty: onHand,
                stock: onHand,
            };
        };
        if (channel === 'retail') {
            const { wholesaleEnabled, minWholesaleQty, dealerLevels, ...rest } = p;
            void wholesaleEnabled;
            void minWholesaleQty;
            void dealerLevels;
            rest.skus = (p.skus || []).map((s) => {
                const { priceTiers, ...skuRest } = s;
                void priceTiers;
                return enrichSku(skuRest);
            });
            return rest;
        }
        return { ...p, skus: (p.skus || []).map((s) => enrichSku(s)) };
    }
    /**
     * 取默认仓库 id；优先 isDefault=true → 否则取最早的 status=1 → 都没有则
     * 自动创建 WH-DEFAULT 兜底。这样保证商品编辑里的库存数字一定能落到 Stock 表，
     * 不会因为没初始化仓库被静默丢弃（之前 db push --force-reset 没跑 seed 时
     * 就会导致库存填了不写）。
     */
    async getDefaultWarehouseId(tx) {
        const wh = (await tx.warehouse.findFirst({ where: { isDefault: true, status: 1 } })) ||
            (await tx.warehouse.findFirst({ where: { status: 1 }, orderBy: { id: 'asc' } }));
        if (wh?.id)
            return wh.id;
        const created = await tx.warehouse.create({
            data: {
                code: 'WH-DEFAULT',
                name: '默认仓库',
                isDefault: true,
                status: 1,
            },
        });
        return created.id;
    }
    /** 给指定 SKU 在默认仓库 upsert 一条 Stock 记录 */
    async upsertStockForSku(tx, skuId, onHand, warehouseId) {
        const safeOnHand = Math.max(Number(onHand) || 0, 0);
        await tx.stock.upsert({
            where: { skuId_warehouseId: { skuId, warehouseId } },
            create: { skuId, warehouseId, onHand: safeOnHand },
            // onHand 仅在前端明确传新值时才覆盖；这里业务上"商品编辑里的库存数字"就代表默认仓数量
            update: { onHand: safeOnHand },
        });
    }
    async create(data) {
        const { skus, ...rest } = data;
        const exist = await this.prisma.product.findUnique({ where: { code: rest.code } });
        if (exist)
            throw new common_1.BadRequestException('商品编码已存在');
        const productScalars = {
            ...rest,
            // 显式接 freeShipping / shippingFee（兼容下划线/驼峰传参）
            freeShipping: rest.freeShipping === true || rest.free_shipping === true,
            shippingFee: rest.shippingFee != null
                ? Number(rest.shippingFee)
                : rest.shipping_fee != null
                    ? Number(rest.shipping_fee)
                    : 0,
            // 运费模板：'' / 0 / null 都视为未选
            shippingTemplateId: rest.shippingTemplateId == null ||
                rest.shippingTemplateId === '' ||
                Number(rest.shippingTemplateId) === 0
                ? null
                : Number(rest.shippingTemplateId),
        };
        delete productScalars.free_shipping;
        delete productScalars.shipping_fee;
        delete productScalars.shipping_template_id;
        return this.prisma.$transaction(async (tx) => {
            const created = await tx.product.create({
                data: {
                    ...productScalars,
                    skus: skus?.length
                        ? {
                            create: skus.map((s) => ({
                                code: s.code,
                                specs: s.specs || {},
                                image: normalizeSkuImage(s),
                                retailPrice: Number(s.retailPrice || 0),
                                // memberPrice 严格表示"零售会员价"，前端绝不能再把批发价塞进来
                                memberPrice: s.memberPrice == null || s.memberPrice === '' ? null : Number(s.memberPrice),
                                costPrice: s.costPrice == null || s.costPrice === '' ? null : Number(s.costPrice),
                                // 库存不写 Sku 表，下面 upsertStockForSku 写到 Stock 表（唯一真源）
                                weight: s.weight == null || s.weight === '' ? null : Number(s.weight),
                                status: s.status ?? 1,
                            })),
                        }
                        : undefined,
                },
                include: { skus: true },
            });
            // 同步：给每个新建 SKU 在默认仓建 Stock + 写 PriceTier
            const warehouseId = await this.getDefaultWarehouseId(tx);
            for (let i = 0; i < (created.skus || []).length; i++) {
                const newSku = created.skus[i];
                const formSku = skus[i] || {};
                await this.upsertStockForSku(tx, newSku.id, formSku.stock || 0, warehouseId);
                const tiers = normalizePriceTiers(formSku.priceTiers);
                if (tiers.length) {
                    await tx.priceTier.createMany({
                        data: tiers.map((t) => ({ skuId: newSku.id, ...t })),
                    });
                }
            }
            return created;
        });
    }
    async update(id, data) {
        const { skus, ...rest } = data;
        await this.findById(id, 'admin');
        const productScalars = { ...rest };
        if (rest.freeShipping !== undefined || rest.free_shipping !== undefined) {
            productScalars.freeShipping = rest.freeShipping === true || rest.free_shipping === true;
        }
        if (rest.shippingFee !== undefined || rest.shipping_fee !== undefined) {
            const v = rest.shippingFee ?? rest.shipping_fee;
            productScalars.shippingFee = v == null || v === '' ? 0 : Number(v);
        }
        if (rest.shippingTemplateId !== undefined ||
            rest.shipping_template_id !== undefined) {
            const v = rest.shippingTemplateId ?? rest.shipping_template_id;
            productScalars.shippingTemplateId =
                v == null || v === '' || Number(v) === 0 ? null : Number(v);
        }
        delete productScalars.free_shipping;
        delete productScalars.shipping_fee;
        delete productScalars.shipping_template_id;
        if (Array.isArray(skus)) {
            await this.prisma.$transaction(async (tx) => {
                await tx.product.update({ where: { id }, data: productScalars });
                const warehouseId = await this.getDefaultWarehouseId(tx);
                const existingSkus = await tx.sku.findMany({ where: { productId: id } });
                const existingById = new Map(existingSkus.map((sku) => [sku.id, sku]));
                const existingByCode = new Map(existingSkus.map((sku) => [sku.code, sku]));
                const touchedIds = [];
                for (const s of skus) {
                    const matchedSku = s.id ? existingById.get(Number(s.id)) : existingByCode.get(s.code);
                    // 表单 stock 不再写到 Sku 表，由 Stock 表唯一持有
                    const formStock = Number(s.stock || 0);
                    const skuData = {
                        code: s.code,
                        specs: s.specs || {},
                        image: normalizeSkuImage(s),
                        retailPrice: Number(s.retailPrice || 0),
                        memberPrice: s.memberPrice == null || s.memberPrice === '' ? null : Number(s.memberPrice),
                        costPrice: s.costPrice == null || s.costPrice === '' ? null : Number(s.costPrice),
                        weight: s.weight == null || s.weight === '' ? null : Number(s.weight),
                        status: s.status ?? 1,
                    };
                    let skuId;
                    if (matchedSku) {
                        await tx.sku.update({ where: { id: matchedSku.id }, data: skuData });
                        skuId = matchedSku.id;
                    }
                    else {
                        const created = await tx.sku.create({ data: { productId: id, ...skuData } });
                        skuId = created.id;
                    }
                    touchedIds.push(skuId);
                    // 同步默认仓 Stock：以表单数字直接覆盖 onHand
                    await this.upsertStockForSku(tx, skuId, formStock, warehouseId);
                    // 重写 PriceTier：先删再插（priceTiers 数量通常很少，简单就好）
                    await tx.priceTier.deleteMany({ where: { skuId } });
                    const tiers = normalizePriceTiers(s.priceTiers);
                    if (tiers.length) {
                        await tx.priceTier.createMany({
                            data: tiers.map((t) => ({ skuId, ...t })),
                        });
                    }
                }
                if (existingSkus.length) {
                    await tx.sku.updateMany({
                        where: { productId: id, id: { notIn: touchedIds.length ? touchedIds : [0] } },
                        data: { status: 0 },
                    });
                }
            });
        }
        else {
            await this.prisma.product.update({ where: { id }, data: productScalars });
        }
        return this.findById(id, 'admin');
    }
    async remove(id) {
        return this.prisma.product.update({
            where: { id },
            data: { status: 0 },
        });
    }
    async toggleListing(id) {
        const p = await this.findById(id, 'admin');
        return this.prisma.product.update({
            where: { id },
            data: { status: p.status === 1 ? 0 : 1 },
        });
    }
    async toggleRetail(id) {
        const p = await this.findById(id, 'admin');
        return this.prisma.product.update({
            where: { id },
            data: { retailEnabled: !p.retailEnabled },
        });
    }
    async toggleWholesale(id) {
        const p = await this.findById(id, 'admin');
        return this.prisma.product.update({
            where: { id },
            data: { wholesaleEnabled: !p.wholesaleEnabled },
        });
    }
    async setStatus(id, status) {
        await this.findById(id, 'admin');
        return this.prisma.product.update({ where: { id }, data: { status } });
    }
    async setRetail(id, enabled) {
        await this.findById(id, 'admin');
        return this.prisma.product.update({ where: { id }, data: { retailEnabled: enabled } });
    }
    async setWholesale(id, enabled) {
        await this.findById(id, 'admin');
        return this.prisma.product.update({ where: { id }, data: { wholesaleEnabled: enabled } });
    }
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