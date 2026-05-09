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
exports.PriceTierService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../common/prisma.service");
let PriceTierService = class PriceTierService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    /** 按 SKU 获取阶梯价列表 */
    async listBySku(skuId) {
        return this.prisma.priceTier.findMany({
            where: { skuId },
            orderBy: { minQty: 'asc' },
        });
    }
    /**
     * 全量替换 SKU 的阶梯价（管理端抽屉"保存阶梯价"走这里）
     * 执行前做区间校验：下一档 minQty 必须 > 上一档 maxQty
     */
    async replace(skuId, tiers) {
        // 按 minQty 排序后校验
        const sorted = [...tiers].sort((a, b) => a.minQty - b.minQty);
        for (let i = 0; i < sorted.length; i++) {
            const t = sorted[i];
            if (t.minQty <= 0)
                throw new common_1.BadRequestException(`第 ${i + 1} 档起订量必须 > 0`);
            if (t.maxQty != null && t.maxQty < t.minQty)
                throw new common_1.BadRequestException(`第 ${i + 1} 档最大数量必须 >= 最小数量`);
            if (t.price <= 0)
                throw new common_1.BadRequestException(`第 ${i + 1} 档价格必须 > 0`);
            if (i > 0) {
                const prev = sorted[i - 1];
                if (prev.maxQty != null && t.minQty <= prev.maxQty)
                    throw new common_1.BadRequestException(`第 ${i + 1} 档与上一档数量区间重叠`);
            }
        }
        await this.prisma.$transaction(async (tx) => {
            await tx.priceTier.deleteMany({ where: { skuId } });
            if (sorted.length) {
                await tx.priceTier.createMany({
                    data: sorted.map((t, idx) => ({
                        skuId,
                        minQty: t.minQty,
                        maxQty: t.maxQty ?? null,
                        price: t.price,
                        sort: idx,
                    })),
                });
            }
        });
        return this.listBySku(skuId);
    }
    /**
     * 根据下单数量匹配最合适的阶梯价
     * 给小程序/批发 H5 在下单计算时调用
     */
    async matchPrice(skuId, qty) {
        const tiers = await this.listBySku(skuId);
        const hit = tiers.find((t) => qty >= t.minQty && (t.maxQty == null || qty <= t.maxQty));
        return hit ? Number(hit.price) : null;
    }
};
exports.PriceTierService = PriceTierService;
exports.PriceTierService = PriceTierService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PriceTierService);
//# sourceMappingURL=price-tier.service.js.map