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
exports.RoleService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../common/prisma.service");
function toStatusInt(status) {
    if (status === undefined || status === null || status === '')
        return undefined;
    if (typeof status === 'number')
        return status;
    return status === 'inactive' || status === 'disabled' || status === '0' ? 0 : 1;
}
let RoleService = class RoleService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findAll() {
        return this.prisma.role.findMany({
            include: {
                _count: { select: { users: true } },
            },
            orderBy: { sort: 'asc' },
        });
    }
    async findById(id) {
        const role = await this.prisma.role.findUnique({
            where: { id },
            include: {
                _count: { select: { users: true } },
            },
        });
        if (!role)
            throw new common_1.NotFoundException('角色不存在');
        return role;
    }
    async create(data) {
        const exists = await this.prisma.role.findUnique({ where: { code: data.code } });
        if (exists)
            throw new common_1.ConflictException('角色编码已存在');
        return this.prisma.role.create({
            data: {
                name: data.name,
                code: data.code,
                description: data.description,
                menuPerms: data.permissions ?? data.menuPerms ?? [],
                dataPerms: data.dataScope ? { scope: data.dataScope } : (data.dataPerms ?? undefined),
                apiPerms: data.apiPerms ?? undefined,
                sort: data.sort ?? 0,
                status: toStatusInt(data.status) ?? 1,
            },
        });
    }
    async update(id, data) {
        const payload = {
            name: data.name,
            description: data.description,
            sort: data.sort,
        };
        if (data.permissions !== undefined || data.menuPerms !== undefined) {
            payload.menuPerms = data.permissions ?? data.menuPerms;
        }
        if (data.dataScope !== undefined) {
            payload.dataPerms = { scope: data.dataScope };
        }
        else if (data.dataPerms !== undefined) {
            payload.dataPerms = data.dataPerms;
        }
        if (data.apiPerms !== undefined)
            payload.apiPerms = data.apiPerms;
        const statusInt = toStatusInt(data.status);
        if (statusInt !== undefined)
            payload.status = statusInt;
        return this.prisma.role.update({
            where: { id },
            data: payload,
        });
    }
    async remove(id) {
        // 账号-角色 中间表统计
        const count = await this.prisma.adminUserRole.count({ where: { roleId: id } });
        if (count > 0) {
            throw new common_1.BadRequestException(`该角色下还有 ${count} 个账号，无法删除`);
        }
        await this.prisma.role.delete({ where: { id } });
        return { success: true };
    }
    async updatePermissions(id, permissions) {
        return this.prisma.role.update({
            where: { id },
            data: { menuPerms: permissions },
        });
    }
};
exports.RoleService = RoleService;
exports.RoleService = RoleService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], RoleService);
//# sourceMappingURL=role.service.js.map