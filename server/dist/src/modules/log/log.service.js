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
exports.LogService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../common/prisma.service");
let LogService = class LogService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findAll(query) {
        const page = Number(query.page) || 1;
        const pageSize = Number(query.pageSize) || 20;
        const where = {};
        if (query.keyword) {
            where.OR = [
                { description: { contains: query.keyword } },
                { username: { contains: query.keyword } },
            ];
        }
        if (query.action)
            where.action = query.action;
        if (query.status)
            where.status = query.status;
        const adminUserId = query.adminUserId ?? query.operatorId;
        if (adminUserId)
            where.adminUserId = Number(adminUserId);
        if (query.startTime || query.endTime) {
            where.createdAt = {};
            if (query.startTime)
                where.createdAt.gte = new Date(query.startTime);
            if (query.endTime)
                where.createdAt.lte = new Date(query.endTime);
        }
        const [list, total] = await Promise.all([
            this.prisma.operationLog.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * pageSize,
                take: pageSize,
            }),
            this.prisma.operationLog.count({ where }),
        ]);
        return { list, total, page, pageSize };
    }
    async findById(id) {
        return this.prisma.operationLog.findUnique({ where: { id: BigInt(id) } });
    }
    async create(data) {
        return this.prisma.operationLog.create({
            data: {
                adminUserId: data.adminUserId ?? data.operatorId,
                username: data.username ?? data.operator ?? 'system',
                module: data.module,
                action: data.action,
                description: data.description ?? data.desc ?? '',
                method: data.method,
                path: data.path,
                ip: data.ip,
                userAgent: data.userAgent,
                params: data.params ?? undefined,
                status: data.status ?? 'success',
                errorMsg: data.errorMsg,
                durationMs: data.durationMs ?? data.duration,
            },
        });
    }
};
exports.LogService = LogService;
exports.LogService = LogService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], LogService);
//# sourceMappingURL=log.service.js.map