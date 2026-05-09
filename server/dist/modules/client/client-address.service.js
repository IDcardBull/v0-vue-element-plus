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
exports.ClientAddressService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../common/prisma.service");
let ClientAddressService = class ClientAddressService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async list(userId) {
        return this.prisma.address.findMany({
            where: { userId },
            orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
        });
    }
    async findOne(userId, id) {
        const addr = await this.prisma.address.findFirst({ where: { id, userId } });
        if (!addr)
            throw new common_1.NotFoundException('地址不存在');
        return addr;
    }
    async create(userId, data) {
        this.validate(data);
        // 若设为默认，先把其它地址取消默认
        if (data.isDefault) {
            await this.prisma.address.updateMany({
                where: { userId },
                data: { isDefault: false },
            });
        }
        // 若是第一条地址，强制默认
        const count = await this.prisma.address.count({ where: { userId } });
        return this.prisma.address.create({
            data: { ...data, userId, isDefault: data.isDefault ?? count === 0 },
        });
    }
    async update(userId, id, data) {
        this.validate(data);
        await this.findOne(userId, id);
        if (data.isDefault) {
            await this.prisma.address.updateMany({
                where: { userId, NOT: { id } },
                data: { isDefault: false },
            });
        }
        return this.prisma.address.update({ where: { id }, data });
    }
    async remove(userId, id) {
        const addr = await this.findOne(userId, id);
        await this.prisma.address.delete({ where: { id } });
        // 若删除的是默认地址且还有其它地址，随便挑一条设为默认
        if (addr.isDefault) {
            const another = await this.prisma.address.findFirst({
                where: { userId },
                orderBy: { updatedAt: 'desc' },
            });
            if (another) {
                await this.prisma.address.update({
                    where: { id: another.id },
                    data: { isDefault: true },
                });
            }
        }
        return { ok: true };
    }
    async setDefault(userId, id) {
        await this.findOne(userId, id);
        await this.prisma.$transaction([
            this.prisma.address.updateMany({ where: { userId }, data: { isDefault: false } }),
            this.prisma.address.update({ where: { id }, data: { isDefault: true } }),
        ]);
        return { ok: true };
    }
    validate(data) {
        const required = [
            'receiver', 'phone', 'province', 'city', 'district', 'detail',
        ];
        for (const k of required) {
            if (!data[k] || String(data[k]).trim() === '') {
                throw new common_1.BadRequestException(`字段 ${k} 不能为空`);
            }
        }
        if (!/^1\d{10}$/.test(data.phone)) {
            throw new common_1.BadRequestException('手机号格式不正确');
        }
    }
};
exports.ClientAddressService = ClientAddressService;
exports.ClientAddressService = ClientAddressService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ClientAddressService);
//# sourceMappingURL=client-address.service.js.map