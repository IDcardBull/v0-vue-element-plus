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
exports.ShippingTemplateService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../common/prisma.service");
function toNumberSafe(value, fallback = 0) {
    if (value === null || value === undefined || value === '')
        return fallback;
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
}
function sanitizeRule(raw) {
    return {
        firstAmount: toNumberSafe(raw?.firstAmount, 1),
        firstPrice: toNumberSafe(raw?.firstPrice, 0),
        continueAmount: toNumberSafe(raw?.continueAmount, 1),
        continuePrice: toNumberSafe(raw?.continuePrice, 0),
    };
}
function sanitizeRegions(raw) {
    if (!Array.isArray(raw))
        return [];
    const set = new Set();
    for (const r of raw) {
        if (typeof r === 'string') {
            const v = r.trim().slice(0, 32);
            if (v)
                set.add(v);
            if (set.size >= 50)
                break;
        }
    }
    return [...set];
}
function sanitizeSpecial(raw) {
    const regions = sanitizeRegions(raw?.regions);
    if (regions.length === 0)
        return null; // 没选地区的行直接丢弃
    return { regions, ...sanitizeRule(raw) };
}
function sanitizeFreeRule(raw) {
    const regions = sanitizeRegions(raw?.regions);
    const threshold = toNumberSafe(raw?.threshold, 0);
    if (threshold <= 0)
        return null;
    return { regions, threshold };
}
function normalizeInput(payload) {
    const name = (payload.templateName ?? payload.name ?? '').toString().trim().slice(0, 128);
    if (!name)
        throw new common_1.BadRequestException('模板名称不能为空');
    const calcTypeNum = Number(payload.calcType);
    const calcType = calcTypeNum === 2 ? 2 : 1; // 默认按件
    const specialRules = Array.isArray(payload.specialRules)
        ? payload.specialRules.map(sanitizeSpecial).filter(Boolean)
        : [];
    const freeShippingEnabled = payload.freeShippingEnabled === true || payload.freeShippingEnabled === 1;
    const freeShippingRules = freeShippingEnabled
        ? Array.isArray(payload.freeShippingRules)
            ? payload.freeShippingRules.map(sanitizeFreeRule).filter(Boolean)
            : []
        : [];
    return {
        name,
        calcType,
        // 三个 Json 字段：Prisma 需要 InputJsonValue（带 index signature 的 plain JSON），
        // 通过 unknown 桥接断言绕开 ShippingRule 等接口缺少 index signature 的报错。
        defaultRule: sanitizeRule(payload.defaultRule || {}),
        specialRules: specialRules,
        freeShippingEnabled,
        freeShippingRules: freeShippingRules,
    };
}
let ShippingTemplateService = class ShippingTemplateService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    list() {
        return this.prisma.shippingTemplate.findMany({
            orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        });
    }
    async detail(id) {
        const found = await this.prisma.shippingTemplate.findUnique({ where: { id } });
        if (!found)
            throw new common_1.NotFoundException('运费模板不存在');
        return found;
    }
    async create(payload) {
        const data = normalizeInput(payload);
        const exists = await this.prisma.shippingTemplate.findUnique({
            where: { name: data.name },
            select: { id: true },
        });
        if (exists)
            throw new common_1.BadRequestException('模板名称已存在');
        return this.prisma.shippingTemplate.create({ data });
    }
    async update(id, payload) {
        await this.detail(id); // 先确认存在
        const data = normalizeInput(payload);
        const conflict = await this.prisma.shippingTemplate.findFirst({
            where: { name: data.name, NOT: { id } },
            select: { id: true },
        });
        if (conflict)
            throw new common_1.BadRequestException('模板名称已存在');
        return this.prisma.shippingTemplate.update({ where: { id }, data });
    }
    async remove(id) {
        await this.detail(id);
        await this.prisma.shippingTemplate.delete({ where: { id } });
        return { success: true };
    }
};
exports.ShippingTemplateService = ShippingTemplateService;
exports.ShippingTemplateService = ShippingTemplateService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ShippingTemplateService);
//# sourceMappingURL=shipping-template.service.js.map