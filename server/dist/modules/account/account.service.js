"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccountService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../common/prisma.service");
const log_service_1 = require("../log/log.service");
const bcrypt = __importStar(require("bcryptjs"));
/** 前端传入的 status 可能是 'active'/'inactive' 字符串，数据库是 Int（1/0） */
function toStatusInt(status) {
    if (status === undefined || status === null || status === '')
        return undefined;
    if (typeof status === 'number')
        return status;
    return status === 'inactive' || status === 'disabled' || status === '0' ? 0 : 1;
}
/** 把 AdminUser + 关联的 roles 扁平化成前端期望的 { ..., role: { id, name, code }, roleId } */
function flattenAdminUser(user) {
    if (!user)
        return user;
    const { password, roles = [], ...rest } = user;
    const firstRole = roles?.[0]?.role;
    return {
        ...rest,
        roleId: firstRole?.id ?? null,
        role: firstRole ?? null,
        roles: roles.map((r) => r.role).filter(Boolean),
    };
}
let AccountService = class AccountService {
    constructor(prisma, logService) {
        this.prisma = prisma;
        this.logService = logService;
    }
    async findAll(query) {
        const page = Number(query.page) || 1;
        const pageSize = Number(query.pageSize) || 20;
        const where = {};
        if (query.keyword) {
            where.OR = [
                { username: { contains: query.keyword } },
                { realName: { contains: query.keyword } },
                { phone: { contains: query.keyword } },
            ];
        }
        const statusInt = toStatusInt(query.status);
        if (statusInt !== undefined)
            where.status = statusInt;
        if (query.roleId)
            where.roles = { some: { roleId: Number(query.roleId) } };
        const [list, total] = await Promise.all([
            this.prisma.adminUser.findMany({
                where,
                include: { roles: { include: { role: true } } },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * pageSize,
                take: pageSize,
            }),
            this.prisma.adminUser.count({ where }),
        ]);
        return { list: list.map(flattenAdminUser), total, page, pageSize };
    }
    async findById(id) {
        const user = await this.prisma.adminUser.findUnique({
            where: { id },
            include: { roles: { include: { role: true } } },
        });
        if (!user)
            throw new common_1.NotFoundException('账号不存在');
        return flattenAdminUser(user);
    }
    async create(data) {
        const exists = await this.prisma.adminUser.findUnique({ where: { username: data.username } });
        if (exists)
            throw new common_1.ConflictException('用户名已存在');
        const hash = await bcrypt.hash(data.password || '123456', 10);
        const roleId = data.roleId ? Number(data.roleId) : null;
        const created = await this.prisma.adminUser.create({
            data: {
                username: data.username,
                password: hash,
                realName: data.realName,
                phone: data.phone,
                email: data.email,
                department: data.department,
                status: toStatusInt(data.status) ?? 1,
                ...(roleId
                    ? { roles: { create: [{ roleId }] } }
                    : {}),
            },
            include: { roles: { include: { role: true } } },
        });
        return flattenAdminUser(created);
    }
    async update(id, data) {
        const payload = {
            realName: data.realName,
            phone: data.phone,
            email: data.email,
            department: data.department,
        };
        const statusInt = toStatusInt(data.status);
        if (statusInt !== undefined)
            payload.status = statusInt;
        if (data.password)
            payload.password = await bcrypt.hash(data.password, 10);
        // 如果传入 roleId，则替换账号与角色的绑定
        if (data.roleId !== undefined && data.roleId !== null && data.roleId !== '') {
            const roleId = Number(data.roleId);
            await this.prisma.adminUserRole.deleteMany({ where: { adminUserId: id } });
            await this.prisma.adminUserRole.create({ data: { adminUserId: id, roleId } });
        }
        const updated = await this.prisma.adminUser.update({
            where: { id },
            data: payload,
            include: { roles: { include: { role: true } } },
        });
        return flattenAdminUser(updated);
    }
    async remove(id) {
        await this.prisma.adminUser.delete({ where: { id } });
        return { success: true };
    }
    async resetPassword(id, newPwd) {
        const hash = await bcrypt.hash(newPwd || '123456', 10);
        await this.prisma.adminUser.update({ where: { id }, data: { password: hash } });
        return { success: true, newPassword: newPwd || '123456' };
    }
};
exports.AccountService = AccountService;
exports.AccountService = AccountService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        log_service_1.LogService])
], AccountService);
//# sourceMappingURL=account.service.js.map