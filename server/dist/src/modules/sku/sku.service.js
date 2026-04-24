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
    async findByProduct(productId) {
        return this.prisma.sku.findMany({
            where: { productId },
            orderBy: { id: 'asc' },
            include: { priceTiers: { orderBy: { minQty: 'asc' } } },
        });
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
        return s;
    }
    async updateStock(id, stock) {
        return this.prisma.sku.update({ where: { id }, data: { stock } });
    }
};
exports.SkuService = SkuService;
exports.SkuService = SkuService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], SkuService);
//# sourceMappingURL=sku.service.js.map