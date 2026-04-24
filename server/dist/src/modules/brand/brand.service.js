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
exports.BrandService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../common/prisma.service");
let BrandService = class BrandService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async search(keyword, status, page = 1, pageSize = 20) {
        const where = {};
        if (keyword)
            where.OR = [{ name: { contains: keyword } }, { code: { contains: keyword } }];
        if (status !== undefined)
            where.status = Number(status);
        const [list, total] = await this.prisma.$transaction([
            this.prisma.brand.findMany({
                where,
                orderBy: [{ sort: 'asc' }, { id: 'desc' }],
                skip: (page - 1) * pageSize,
                take: pageSize,
                include: { _count: { select: { products: true } } },
            }),
            this.prisma.brand.count({ where }),
        ]);
        return {
            list: list.map((b) => ({ ...b, productCount: b._count.products })),
            total,
            page,
            pageSize,
        };
    }
    async findAll() {
        return this.prisma.brand.findMany({
            where: { status: 1 },
            orderBy: [{ sort: 'asc' }],
        });
    }
    async findById(id) {
        const b = await this.prisma.brand.findUnique({
            where: { id },
            include: { _count: { select: { products: true } } },
        });
        if (!b)
            throw new common_1.NotFoundException('品牌不存在');
        return { ...b, productCount: b._count.products };
    }
    async create(data) {
        const exist = await this.prisma.brand.findUnique({ where: { code: data.code } });
        if (exist)
            throw new common_1.BadRequestException('品牌编码已存在');
        return this.prisma.brand.create({ data });
    }
    async update(id, data) {
        await this.findById(id);
        return this.prisma.brand.update({ where: { id }, data });
    }
    async remove(id) {
        const cnt = await this.prisma.product.count({ where: { brandId: id } });
        if (cnt)
            throw new common_1.BadRequestException('该品牌下还有商品，无法删除');
        return this.prisma.brand.delete({ where: { id } });
    }
    async toggleStatus(id) {
        const b = await this.findById(id);
        return this.prisma.brand.update({
            where: { id },
            data: { status: b.status === 1 ? 0 : 1 },
        });
    }
};
exports.BrandService = BrandService;
exports.BrandService = BrandService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], BrandService);
//# sourceMappingURL=brand.service.js.map