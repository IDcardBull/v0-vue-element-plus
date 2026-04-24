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
exports.CategoryService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../common/prisma.service");
let CategoryService = class CategoryService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    /** 获取完整分类树 */
    async tree() {
        const all = await this.prisma.category.findMany({
            orderBy: [{ sort: 'asc' }, { id: 'asc' }],
            include: { _count: { select: { products: true } } },
        });
        const map = new Map();
        const roots = [];
        for (const c of all) {
            map.set(c.id, { ...c, productCount: c._count.products, children: [] });
        }
        for (const c of all) {
            const node = map.get(c.id);
            if (c.parentId && map.has(c.parentId)) {
                map.get(c.parentId).children.push(node);
            }
            else {
                roots.push(node);
            }
        }
        return roots;
    }
    async findAll() {
        return this.prisma.category.findMany({
            orderBy: [{ level: 'asc' }, { sort: 'asc' }],
        });
    }
    async findById(id) {
        const c = await this.prisma.category.findUnique({
            where: { id },
            include: {
                parent: true,
                children: true,
                _count: { select: { products: true, children: true } },
            },
        });
        if (!c)
            throw new common_1.NotFoundException('分类不存在');
        return {
            ...c,
            productCount: c._count.products,
            childrenCount: c._count.children,
        };
    }
    async create(data) {
        let level = 1;
        if (data.parentId) {
            const parent = await this.prisma.category.findUnique({ where: { id: data.parentId } });
            if (!parent)
                throw new common_1.BadRequestException('父分类不存在');
            level = parent.level + 1;
        }
        return this.prisma.category.create({ data: { ...data, level } });
    }
    async update(id, data) {
        await this.findById(id);
        return this.prisma.category.update({ where: { id }, data });
    }
    async remove(id) {
        const hasChild = await this.prisma.category.count({ where: { parentId: id } });
        if (hasChild)
            throw new common_1.BadRequestException('请先删除子分类');
        const hasProduct = await this.prisma.product.count({ where: { categoryId: id } });
        if (hasProduct)
            throw new common_1.BadRequestException('该分类下还有商品，无法删除');
        return this.prisma.category.delete({ where: { id } });
    }
    async toggleStatus(id) {
        const c = await this.findById(id);
        return this.prisma.category.update({
            where: { id },
            data: { status: c.status === 1 ? 0 : 1 },
        });
    }
};
exports.CategoryService = CategoryService;
exports.CategoryService = CategoryService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], CategoryService);
//# sourceMappingURL=category.service.js.map