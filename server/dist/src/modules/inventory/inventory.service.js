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
/**
 * 简化版（v2，2026-05）库存服务：
 * - 只展示 SKU/商品信息 + 现存数量 onHand
 * - 不再有出入库流水（StockLog 表已删）、不再有 reserved/inTransit/warnMin/warnMax
 * - 出入库按钮、库存预警页、出入库记录页均已下线
 */
let InventoryService = class InventoryService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    // -------------------- 仓库 --------------------
    async warehouses() {
        return this.prisma.warehouse.findMany({
            orderBy: [{ isDefault: 'desc' }, { id: 'asc' }],
        });
    }
    // -------------------- 实时库存 --------------------
    stockInclude() {
        return {
            warehouse: { select: { id: true, name: true, code: true } },
            sku: {
                select: {
                    id: true,
                    code: true,
                    specs: true,
                    image: true,
                    product: {
                        select: {
                            id: true,
                            code: true,
                            name: true,
                            mainImage: true,
                            category: { select: { name: true } },
                        },
                    },
                },
            },
        };
    }
    specText(specs) {
        if (!specs)
            return '';
        if (typeof specs === 'string')
            return specs;
        if (Array.isArray(specs))
            return specs.map((v) => String(v ?? '')).join(' ');
        if (typeof specs === 'object')
            return Object.values(specs).map((v) => String(v ?? '')).join(' ');
        return String(specs);
    }
    async stockList(q) {
        const page = Number(q.page) || 1;
        const pageSize = Number(q.pageSize) || 20;
        const skuCode = (q.skuCode || '').trim();
        const productName = (q.productName || '').trim();
        const spec = (q.spec || '').trim();
        const keyword = (q.keyword || '').trim();
        const where = {};
        if (q.warehouseId)
            where.warehouseId = Number(q.warehouseId);
        const skuWhere = {};
        if (skuCode)
            skuWhere.code = { contains: skuCode };
        if (productName || q.categoryId) {
            skuWhere.product = {
                ...(productName ? { name: { contains: productName } } : {}),
                ...(q.categoryId ? { categoryId: Number(q.categoryId) } : {}),
            };
        }
        if (keyword && !skuCode && !productName && !spec) {
            skuWhere.OR = [
                { code: { contains: keyword } },
                { product: { name: { contains: keyword } } },
                { product: { code: { contains: keyword } } },
            ];
        }
        if (Object.keys(skuWhere).length)
            where.sku = skuWhere;
        const include = this.stockInclude();
        if (spec) {
            const rows = await this.prisma.stock.findMany({
                where,
                orderBy: [{ id: 'desc' }],
                include,
            });
            const filtered = rows.filter((row) => this.specText(row.sku?.specs).includes(spec));
            return {
                list: filtered.slice((page - 1) * pageSize, page * pageSize),
                total: filtered.length,
                page,
                pageSize,
            };
        }
        const [list, total] = await this.prisma.$transaction([
            this.prisma.stock.findMany({
                where,
                orderBy: [{ id: 'desc' }],
                skip: (page - 1) * pageSize,
                take: pageSize,
                include,
            }),
            this.prisma.stock.count({ where }),
        ]);
        return { list, total, page, pageSize };
    }
    async updateStock(id, onHand) {
        const stock = await this.prisma.stock.findUnique({
            where: { id },
            select: { id: true },
        });
        if (!stock)
            throw new common_1.NotFoundException('库存记录不存在');
        const safe = Math.max(Number(onHand) || 0, 0);
        return this.prisma.stock.update({
            where: { id },
            data: { onHand: safe },
            include: this.stockInclude(),
        });
    }
};
exports.InventoryService = InventoryService;
exports.InventoryService = InventoryService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], InventoryService);
//# sourceMappingURL=inventory.service.js.map