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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClientUserController = void 0;
const common_1 = require("@nestjs/common");
const class_validator_1 = require("class-validator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const prisma_service_1 = require("../../common/prisma.service");
class UpdateProfileDto {
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", String)
], UpdateProfileDto.prototype, "nickname", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], UpdateProfileDto.prototype, "avatar", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], UpdateProfileDto.prototype, "gender", void 0);
let ClientUserController = class ClientUserController {
    constructor(prisma) {
        this.prisma = prisma;
    }
    ensureClient(user) {
        if (user.userType !== 'client')
            throw new common_1.ForbiddenException('仅小程序用户可访问');
    }
    async profile(user) {
        this.ensureClient(user);
        const u = await this.prisma.user.findUnique({
            where: { id: user.sub },
            include: { level: true },
        });
        if (!u)
            return null;
        return {
            id: u.id,
            nickname: u.nickname,
            avatar: u.avatar,
            phone: u.phone,
            gender: u.gender,
            role: u.role,
            level: u.level ? { id: u.level.id, name: u.level.name } : null,
            points: u.points,
            balance: u.balance,
            totalSpent: u.totalSpent,
            registeredAt: u.registeredAt,
        };
    }
    async updateProfile(user, dto) {
        this.ensureClient(user);
        const updated = await this.prisma.user.update({
            where: { id: user.sub },
            data: {
                nickname: dto.nickname,
                avatar: dto.avatar,
                gender: dto.gender,
            },
        });
        return { ok: true, id: updated.id };
    }
};
exports.ClientUserController = ClientUserController;
__decorate([
    (0, common_1.Get)('profile'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ClientUserController.prototype, "profile", null);
__decorate([
    (0, common_1.Patch)('profile'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, UpdateProfileDto]),
    __metadata("design:returntype", Promise)
], ClientUserController.prototype, "updateProfile", null);
exports.ClientUserController = ClientUserController = __decorate([
    (0, common_1.Controller)('client/user'),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ClientUserController);
//# sourceMappingURL=client-user.controller.js.map