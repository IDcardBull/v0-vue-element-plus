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
exports.DictService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../common/prisma.service");
let DictService = class DictService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async types() {
        return this.prisma.dictType.findMany({
            orderBy: [{ sort: 'asc' }, { id: 'asc' }],
            include: { _count: { select: { items: true } } },
        });
    }
    async ensureType(typeCode, typeName) {
        const code = typeCode.trim();
        if (!code)
            throw new common_1.BadRequestException('字典类型编码不能为空');
        return this.prisma.dictType.upsert({
            where: { code },
            create: { code, name: typeName || code },
            update: typeName ? { name: typeName } : {},
        });
    }
    async items(typeCode, includeDisabled = false) {
        return this.prisma.dictItem.findMany({
            where: {
                typeCode,
                ...(includeDisabled ? {} : { status: 1 }),
            },
            orderBy: [{ sort: 'asc' }, { id: 'asc' }],
        });
    }
    async createItem(typeCode, data) {
        await this.ensureType(typeCode, data.typeName);
        const label = String(data.label || data.value || '').trim();
        const value = String(data.value || data.label || '').trim();
        if (!label || !value)
            throw new common_1.BadRequestException('字典项名称和值不能为空');
        const exists = await this.prisma.dictItem.findUnique({
            where: { typeCode_value: { typeCode, value } },
        });
        if (exists)
            throw new common_1.BadRequestException('字典项已存在');
        return this.prisma.dictItem.create({
            data: {
                typeCode,
                label,
                value,
                sort: Number(data.sort) || 0,
                status: data.status === undefined ? 1 : Number(data.status),
                remark: data.remark,
            },
        });
    }
    async updateItem(id, data) {
        await this.findItem(id);
        return this.prisma.dictItem.update({
            where: { id },
            data: {
                label: data.label,
                value: data.value,
                sort: data.sort === undefined ? undefined : Number(data.sort),
                status: data.status === undefined ? undefined : Number(data.status),
                remark: data.remark,
            },
        });
    }
    async findItem(id) {
        const item = await this.prisma.dictItem.findUnique({ where: { id } });
        if (!item)
            throw new common_1.NotFoundException('字典项不存在');
        return item;
    }
    async removeItem(id) {
        await this.findItem(id);
        return this.prisma.dictItem.delete({ where: { id } });
    }
    async toggleItem(id) {
        const item = await this.findItem(id);
        return this.prisma.dictItem.update({
            where: { id },
            data: { status: item.status === 1 ? 0 : 1 },
        });
    }
};
exports.DictService = DictService;
exports.DictService = DictService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], DictService);
//# sourceMappingURL=dict.service.js.map